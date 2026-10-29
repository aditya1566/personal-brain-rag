'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, FileText, Sparkles, Loader2, Upload } from 'lucide-react';
import UploadModal from '../components/UploadModal';

interface Message {
  role: 'user' | 'model';
  content: string;
  metadata?: any[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [userId] = useState('test_user_123'); // Default test user
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false); // Modal state

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    const newHistory = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newHistory);
    setIsLoading(true);

    // Placeholder model message for live streaming tokens
    setMessages((prev) => [...prev, { role: 'model', content: '', metadata: [] }]);

    try {
      const response = await fetch(
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            message: userMessage,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        }
      );

      if (!response.body) throw new Error('Response body missing');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';
      let receivedMetadata: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.replace('data: ', '').trim();
            if (raw === '[DONE]') break;

            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'metadata') {
                receivedMetadata = parsed.retrievedChunks || [];
              } else if (parsed.type === 'text') {
                streamedText += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'model',
                    content: streamedText,
                    metadata: receivedMetadata,
                  };
                  return updated;
                });
              }
            } catch (err) {
              // Ignore partial chunk parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: '⚠️ Error connecting to knowledge base server.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        userId={userId}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Personal Brain Assistant</h1>
            <p className="text-xs text-slate-400">Connected to Qdrant Vector DB & Gemini RAG</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Add Upload Button */}
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-medium transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>

          <div className="text-xs px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-300">
            User ID: <span className="text-indigo-400 font-mono">{userId}</span>
          </div>
        </div>
      </header>

      {/* Message Stream Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6 h-full flex flex-col justify-between">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center my-auto text-center text-slate-500 space-y-3">
              <Bot className="w-12 h-12 stroke-1 text-indigo-500 animate-pulse" />
              <p className="text-sm">Ask anything about your uploaded knowledge base files or policies.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-3 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white shadow-lg">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl space-y-2 ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed shadow-md ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                      }`}
                    >
                      {msg.role === 'model' ? (
                        <div className="prose prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>

                    {/* Citations */}
                    {msg.metadata && msg.metadata.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.metadata.map((chunk, cIdx) => (
                          <div
                            key={cIdx}
                            className="flex items-center space-x-1.5 text-xs bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-md text-slate-400 shadow-sm"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="font-medium text-slate-300">{chunk.documentId}</span>
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                              Score: {(chunk.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-300 shadow-lg">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input Footer */}
      <footer className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            disabled={isLoading}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-3 rounded-xl transition-all shadow-lg flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}