
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User, LoaderCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chat } from '@/ai/flows/chat';
import type { CustomPeriodSettings } from '@/lib/attendance';

interface ChatbotProps {
  result: string;
  customSettings: CustomPeriodSettings;
}

interface Message {
  role: 'user' | 'bot';
  content: string;
}

export default function Chatbot({ result, customSettings }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the bottom when messages change
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = `
        Current attendance calculation result: ${result}
        Custom settings: ${customSettings.percentage}% required, Periods per day (Sun-Sat): ${customSettings.periods.join(', ')}
      `;
      const aiResponse = await chat(input, context);
      const botMessage: Message = { role: 'bot', content: aiResponse };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage: Message = {
        role: 'bot',
        content: "Sorry, I'm having trouble connecting. Please try again later.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot /> AI Assistant</CardTitle>
        <CardDescription>Ask me anything about your attendance or how to use the app.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 w-full pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-start gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'bot' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot size={20} />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-xs rounded-lg px-4 py-2 text-sm md:max-w-md',
                    message.role === 'user'
                      ? 'bg-primary/20'
                      : 'bg-muted'
                  )}
                >
                  <p>{message.content}</p>
                </div>
                 {message.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <User size={20} />
                  </div>
                )}
              </div>
            ))}
             {isLoading && (
              <div className="flex items-center gap-3 justify-start">
                 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot size={20} />
                  </div>
                <div className="max-w-xs rounded-lg px-4 py-2 text-sm bg-muted flex items-center">
                   <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                   Thinking...
                </div>
              </div>
            )}
             {messages.length === 0 && !isLoading && (
                 <div className="text-center text-muted-foreground p-4">
                    <p>Welcome! Ask me a question like "How many days can I miss?" or "Explain the 'Project Future' feature."</p>
                 </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
