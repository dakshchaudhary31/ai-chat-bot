import axios from "axios";
import { useState, useRef, useEffect } from "react";
import { FaRobot, FaPaperPlane, FaCopy, FaStop } from "react-icons/fa";
import { ImSpinner2 } from "react-icons/im";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// API KEY
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [displayedText, setDisplayedText] = useState([]);
  const [typingStopped, setTypingStopped] = useState(false);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const startSound = new Audio("/start.mp3");
  const stopSound = new Audio("/stop.mp3");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  if (recognition) {
    recognition.continuous = false;
    recognition.lang = "en-US";
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, displayedText]);

  async function generateAnswer() {
    if (!question.trim()) return;

    const userMessage = { type: "user", text: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);
    setTypingStopped(false);

    try {
      const concisePrompt = `Answer this in simple, clear points without extra explanation:\n${question}`;

      const response = await axios({
        url: `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
        method: "POST",
        data: {
          contents: [
            {
              parts: [
                {
                  text: concisePrompt,
                },
              ],
            },
          ],
        },
      });

      const rawAnswer =
        response.data.candidates[0].content.parts[0].text || "No response.";

      const formatted = rawAnswer
        .split(/\n|•|- |\d+\./)
        .map((line) => line.trim())
        .filter((line) => line !== "");

      let currentIndex = 0;
      let tempText = [];

      function typeNext() {
        if (typingStopped) {
          if (tempText.length > 0) {
            const aiMessage = { type: "ai", text: tempText };
            setMessages((prev) => [...prev, aiMessage]);
          }
          setDisplayedText([]);
          setLoading(false);
          return;
        }
        if (currentIndex < formatted.length) {
          tempText.push(formatted[currentIndex]);
          setDisplayedText([...tempText]);
          currentIndex++;
          typingTimeoutRef.current = setTimeout(typeNext, 200);
        } else {
          const aiMessage = { type: "ai", text: formatted };
          setMessages((prev) => [...prev, aiMessage]);
          setDisplayedText([]);
          setLoading(false);
        }
      }

      typeNext();
    } catch (error) {
      console.error("Axios error:", error.response?.data || error.message);
      setMessages((prev) => [
        ...prev,
        { type: "ai", text: ["Error fetching response."] },
      ]);
      setLoading(false);
    }
  }

  function stopTyping() {
    setTypingStopped(true);
    clearTimeout(typingTimeoutRef.current);

    if (displayedText.length > 0) {
      const aiMessage = { type: "ai", text: displayedText };
      setMessages((prev) => [...prev, aiMessage]);
    }

    setDisplayedText([]);
    setLoading(false);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied to clipboard!");
    });
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);

    const userMessage = {
      type: "user-file",
      fileName: file.name,
      fileUrl: fileUrl,
    };

    setMessages((prev) => [...prev, userMessage]);
  }

  function handleVoiceInput() {
    if (!recognition) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }

    if (listening) {
      recognition.stop();
      setListening(false);
      stopSound.play();
    } else {
      recognition.start();
      setListening(true);
      startSound.play();
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion((prev) => prev + " " + transcript);
      stopSound.play();
    };

    recognition.onend = () => {
      setListening(false);
      stopSound.play();
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      toast.error("Voice input error: " + event.error);
      setListening(false);
      stopSound.play();
    };
  }

  return (
    <div className="flex flex-col sm:h-screen md:h-screen h-[85vh] bg-gradient-to-tl from-gray-700 via-gray-900 to-black text-white custom-scrollbar">
      <ToastContainer position="bottom-right" autoClose={2000} />

      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center gap-3 justify-center">
        <img src="./favicon.png" width={40} alt="" />
        <h1 className="text-2xl font-bold">AI Chat Bot</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6  flex flex-col items-center">
        {messages.map((msg, index) =>
          msg.type === "user" ? (
            <div key={index} className="w-full  max-w-3xl flex justify-end">
              <p className="bg-cyan-700 px-5 py-3 rounded-xl text-lg break-words whitespace-pre-wrap max-w-md">
                {msg.text}
              </p>
            </div>
          ) : msg.type === "user-file" ? (
            <div key={index} className="w-full max-w-3xl flex justify-end">
              <div className="bg-cyan-600 px-5 py-3 rounded-xl text-lg max-w-xs">
                {msg.fileName.match(/\.(jpg|jpeg|png|gif)$/) ? (
                  <img
                    src={msg.fileUrl}
                    alt="Uploaded"
                    className="max-w-xs rounded-md"
                  />
                ) : (
                  <a
                    href={msg.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {msg.fileName}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div
              key={index}
              className="w-full max-w-3xl flex items-start gap-3 justify-center"
            >
              <FaRobot className="text-cyan-400 mt-1 text-2xl" />
              <div className="border border-gray-800 shadow-2xl bg-transparent px-6 py-4 rounded-xl text-lg max-w-full flex flex-col gap-3">
                {msg.text.map((line, i) => (
                  <p key={i} className="leading-relaxed">
                    {line}
                  </p>
                ))}
                <button
                  onClick={() => copyToClipboard(msg.text.join("\n"))}
                  className="self-end text-cyan-400 hover:text-cyan-300 flex items-center gap-2 mt-2"
                >
                  <FaCopy /> Copy
                </button>
              </div>
            </div>
          )
        )}

        {/* Typing animation block */}
        {displayedText.length > 0 && (
          <div className="w-full max-w-3xl flex items-start gap-3 justify-center">
            <FaRobot className="text-cyan-400 mt-1 text-2xl" />
            <div className="bg-gray-800 px-6 py-4 rounded-xl text-lg max-w-full flex flex-col gap-3">
              {displayedText.map((line, i) => (
                <p key={i} className="leading-relaxed">
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Thinking... */}
        {loading && displayedText.length === 0 && (
          <div className="w-full max-w-3xl flex items-start gap-3 justify-center">
            <FaRobot className="text-cyan-400 mt-1 text-2xl" />
            <div className="bg-gray-800 px-6 py-4 rounded-xl text-lg max-w-full">
              <p className="animate-pulse">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={bottomRef}></div>
      </div>

      {/* Input Box */}
      <div className="p-4 border-t border-gray-700">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) generateAnswer();
          }}
          className="flex items-center gap-3 max-w-3xl mx-auto"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ask me anything..."
              className="w-full bg-gray-800 rounded-full px-6 py-4 pr-20 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-lg"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />

            {/* Icons */}
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="text-white text-2xl hover:text-gray-300"
              >
                +
              </button>

              <button
                type="button"
                onClick={handleVoiceInput}
                className="text-white hover:text-gray-300"
              >
                <img src="/mic.png" width={18} alt="Mic" className="invert" />
              </button>

              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
              />
            </div>
          </div>

          {/* Send / Stop button */}
          {loading ? (
            <button
              type="button"
              onClick={stopTyping}
              className="bg-red-500 hover:bg-red-600 p-4 rounded-full transition duration-300"
            >
              <FaStop />
            </button>
          ) : (
            <button
              type="submit"
              className="bg-cyan-500 hover:bg-cyan-600 p-4 rounded-full transition duration-300"
            >
              <FaPaperPlane />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default App;
