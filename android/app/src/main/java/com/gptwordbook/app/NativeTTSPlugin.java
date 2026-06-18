package com.gptwordbook.app;

import android.content.Context;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.HashMap;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "NativeTTS")
public class NativeTTSPlugin extends Plugin {

    private static final String TAG = "NativeTTS";
    private TextToSpeech tts = null;
    private boolean initialized = false;
    private CountDownLatch initLatch = new CountDownLatch(1);

    @Override
    public void load() {
        Log.d(TAG, "Loading NativeTTS plugin...");
        tts = new TextToSpeech(getContext(), new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                Log.d(TAG, "TTS onInit called, status=" + status);
                if (status == TextToSpeech.SUCCESS) {
                    initialized = true;
                    // 设置语言为美式英语
                    int result = tts.setLanguage(Locale.US);
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        Log.w(TAG, "US English not supported, trying default");
                        tts.setLanguage(Locale.ENGLISH);
                    }
                } else {
                    Log.e(TAG, "TTS initialization failed, status=" + status);
                }
                initLatch.countDown();
            }
        });
    }

    private boolean ensureInitialized(PluginCall call) {
        if (tts == null) {
            call.reject("TTS engine not created");
            return false;
        }
        if (!initialized) {
            // 等待初始化完成（最多 5 秒）
            try {
                Log.d(TAG, "Waiting for TTS initialization...");
                boolean ready = initLatch.await(5, TimeUnit.SECONDS);
                if (!ready || !initialized) {
                    call.reject("TTS engine not available. Please install TTS data in Settings > Accessibility > Text-to-Speech.");
                    return false;
                }
            } catch (InterruptedException e) {
                call.reject("TTS initialization interrupted");
                return false;
            }
        }
        return true;
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.isEmpty()) {
            call.reject("Text is required");
            return;
        }

        if (!ensureInitialized(call)) return;

        String lang = call.getString("lang", "en-US");
        float rate = call.getDouble("rate", 1.0).floatValue();
        float pitch = call.getDouble("pitch", 1.0).floatValue();
        float volume = call.getDouble("volume", 1.0).floatValue();

        // 设置语言
        Locale locale = Locale.US;
        if ("en-GB".equals(lang)) locale = Locale.UK;
        else if ("en-AU".equals(lang)) locale = Locale.ENGLISH;
        tts.setLanguage(locale);

        // 设置语速、音调、音量
        tts.setSpeechRate(rate);
        tts.setPitch(pitch);

        // 使用 HashMap 传递 utteranceId 以获取回调
        HashMap<String, String> params = new HashMap<>();
        params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "gptwordbook");

        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params);

        if (result == TextToSpeech.SUCCESS) {
            Log.d(TAG, "TTS speak success: " + text);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            Log.e(TAG, "TTS speak failed, result=" + result);
            call.reject("TTS speak failed with code: " + result);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) {
            tts.stop();
        }
        call.resolve();
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", initialized);
        call.resolve(ret);
    }

    @PluginMethod
    public void cleanup(PluginCall call) {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
            initialized = false;
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
            initialized = false;
        }
    }
}
