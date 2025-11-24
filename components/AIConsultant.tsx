import React, { useState } from 'react';
import { Subnet, IPRecord, User } from '../types';
import { askNetworkAdvisor, suggestSubnetPlan } from '../services/geminiService';
import { Send, Bot, Loader2, PlusCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIConsultantProps {
  subnets: Subnet[];
  onAddSuggestion: (name: string, cidr: string) => void;
  currentUser: User;
}

export const AIConsultant: React.FC<AIConsultantProps> = ({ subnets, onAddSuggestion, currentUser }) => {
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string, suggestion?: any}[]>([
    {role: 'ai', text: `Halo ${currentUser.username}! Saya asisten jaringan AI Nexus. ${currentUser.role === 'admin' ? 'Saya bisa membantu Anda membuat subnet baru.' : 'Saya bisa membantu Anda menganalisis penggunaan IP.'} Apa yang bisa saya bantu?`}
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const isAdmin = currentUser.role === 'admin';

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    // Prepare context
    const context = JSON.stringify(subnets.map(s => ({ 
        name: s.name, 
        cidr: s.cidr, 
        usage: (Object.values(s.records) as IPRecord[]).filter(r => r.status !== 'Available').length 
    })));

    let responseText = '';
    let suggestionData = null;

    // Heuristic to detect if user wants a plan vs just chat
    // Only allow suggestion generation for Admins if they explicitly ask for creation
    if (isAdmin && (userMsg.toLowerCase().includes('buatkan') || userMsg.toLowerCase().includes('plan') || userMsg.toLowerCase().includes('suggest'))) {
        const jsonStr = await suggestSubnetPlan(userMsg);
        try {
            suggestionData = JSON.parse(jsonStr);
            responseText = `Berdasarkan kebutuhan Anda, saya menyarankan konfigurasi subnet berikut:\n\n**${suggestionData.name}**\nCIDR: \`${suggestionData.cidr}\`\n\n${suggestionData.description}`;
        } catch (e) {
            responseText = await askNetworkAdvisor(userMsg, context);
        }
    } else {
        responseText = await askNetworkAdvisor(userMsg, context);
    }

    setChatHistory(prev => [...prev, { role: 'ai', text: responseText, suggestion: suggestionData }]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center space-x-3">
        <div className="bg-cyan-500/20 p-2 rounded-full">
            <Bot className="text-cyan-400" size={24} />
        </div>
        <div>
            <h2 className="text-white font-bold">Network Consultant AI</h2>
            <p className="text-xs text-slate-400">Powered by Gemini 2.5</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-4 ${msg.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                    <ReactMarkdown className="prose prose-invert prose-sm">
                        {msg.text}
                    </ReactMarkdown>
                    {isAdmin && msg.suggestion && msg.suggestion.cidr && (
                        <div className="mt-4 pt-3 border-t border-slate-700/50">
                            <button 
                                onClick={() => onAddSuggestion(msg.suggestion.name, msg.suggestion.cidr)}
                                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-sm transition-colors w-full justify-center"
                            >
                                <PlusCircle size={16} /> <span>Create this Subnet</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-slate-800 p-4 rounded-lg flex items-center space-x-2 text-slate-400">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Thinking...</span>
                </div>
            </div>
        )}
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex space-x-2">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isAdmin ? "Ask to create a subnet plan..." : "Ask about network details..."}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-cyan-500"
            />
            <button 
                onClick={handleSend}
                disabled={isLoading}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white p-2 rounded-lg"
            >
                <Send size={20} />
            </button>
        </div>
      </div>
    </div>
  );
};