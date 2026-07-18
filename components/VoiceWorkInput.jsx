"use client";

import { useEffect, useRef, useState } from "react";

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function VoiceWorkInput({ value = "", onTranscript, highlighted = false }) {
  const recognitionRef = useRef(null);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState(highlighted ? "點麥克風後說出工作內容" : "");

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    return () => recognitionRef.current?.abort();
  }, []);

  function stopListening() {
    recognitionRef.current?.stop();
  }

  function startListening() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setSupported(false);
      setMessage("此瀏覽器不支援語音輸入，請改用手機 Chrome 或 Edge。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setListening(true);
      setMessage("正在聆聽，請說出工作內容…");
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = String(event.results[index][0]?.transcript || "").trim();
        if (event.results[index].isFinal) finalText += `${text} `;
        else interimText += text;
      }

      if (interimText) setMessage(`辨識中：${interimText}`);
      if (finalText.trim()) {
        const nextValue = [String(value || "").trim(), finalText.trim()].filter(Boolean).join(" ");
        onTranscript?.(nextValue);
        setMessage("語音已填入，確認內容後即可新增工作。");
      }
    };

    recognition.onerror = (event) => {
      const messages = {
        "not-allowed": "麥克風權限未開啟，請在瀏覽器設定允許使用麥克風。",
        "no-speech": "沒有聽到語音，請靠近麥克風再試一次。",
        network: "語音辨識需要網路，請確認連線後再試。"
      };
      setMessage(messages[event.error] || "語音辨識中斷，請再試一次。");
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
      setMessage("麥克風正在使用中，請稍後再試。");
    }
  }

  return (
    <div className={`voice-work-input ${highlighted ? "is-highlighted" : ""}`}>
      <button
        className={listening ? "is-listening" : ""}
        type="button"
        disabled={!supported}
        aria-pressed={listening}
        onClick={listening ? stopListening : startListening}
      >
        <span aria-hidden="true">🎙️</span>
        {listening ? "停止" : "語音輸入"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
