import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MessageCircle, Send, X, Users, Hash, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as Tabs from '@radix-ui/react-tabs';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  channel: 'global' | 'lucky2' | 'bingo';
}

type Channel = {
  id: 'global' | 'lucky2' | 'bingo';
  name: string;
  icon: typeof Globe;
  color: string;
};

const CHANNELS: Channel[] = [
  { id: 'global', name: 'Global', icon: Globe, color: 'from-blue-600 to-purple-600' },
  { id: 'lucky2', name: 'Lucky2', icon: Hash, color: 'from-yellow-600 to-red-600' },
  { id: 'bingo', name: 'Bingo', icon: Hash, color: 'from-green-600 to-teal-600' }
];

export function ChatBubble() {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Record<Channel['id'], ChatMessage[]>>({
    global: [],
    lucky2: [],
    bingo: []
  });
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [activeChannel, setActiveChannel] = useState<Channel['id']>('global');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen to chat messages for each channel
    const unsubscribers = CHANNELS.map(channel => {
      const messagesQuery = query(
        collection(db, 'chatMessages'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      return onSnapshot(messagesQuery, (snapshot) => {
        const chatMessages = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          }))
          .filter(msg => msg.channel === channel.id) as ChatMessage[];

        setMessages(prev => ({
          ...prev,
          [channel.id]: chatMessages.reverse()
        }));
        
        // Scroll to bottom on new messages
        if (isOpen && activeChannel === channel.id) {
          scrollToBottom();
        }
      });
    });

    // Simulate online users count
    const randomOnlineUsers = Math.floor(Math.random() * 20) + 10;
    setOnlineUsers(randomOnlineUsers);

    return () => unsubscribers.forEach(unsub => unsub());
  }, [isOpen, activeChannel]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'chatMessages'), {
        userId: user.id,
        username: user.username,
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        channel: activeChannel
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (!user) return null;

  const currentChannel = CHANNELS.find(c => c.id === activeChannel)!;

  return (
    <>
      {/* Chat Bubble - Adjusted positioning for mobile */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl md:bottom-6 md:right-6 md:h-14 md:w-14"
      >
        <MessageCircle className="h-5 w-5 md:h-6 md:w-6" />
      </button>

      {/* Chat Dialog - Full screen on mobile */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 top-0 z-50 flex flex-col bg-white md:bottom-20 md:right-6 md:top-auto md:w-96 md:rounded-lg md:shadow-xl">
          {/* Header */}
          <div className={`flex items-center justify-between border-b bg-gradient-to-r ${currentChannel.color} p-3 md:p-4`}>
            <div className="flex items-center space-x-2">
              <currentChannel.icon className="h-4 w-4 md:h-5 md:w-5" />
              <h3 className="text-sm font-semibold text-white md:text-base">{currentChannel.name} Chat</h3>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 rounded-full bg-white/20 px-2 py-1 text-xs text-white">
                <Users className="h-3 w-3" />
                <span>{onlineUsers} online</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>
          </div>

          {/* Channel Tabs - Compact on mobile */}
          <Tabs.Root value={activeChannel} onValueChange={setActiveChannel}>
            <Tabs.List className="flex border-b px-1">
              {CHANNELS.map(channel => (
                <Tabs.Trigger
                  key={channel.id}
                  value={channel.id}
                  className={`flex-1 border-b-2 px-2 py-2 text-xs font-medium transition-colors md:px-4 md:text-sm ${
                    activeChannel === channel.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <channel.icon className="h-3 w-3 md:h-4 md:w-4" />
                    <span>{channel.name}</span>
                  </div>
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {/* Messages - Adjusted padding and text sizes */}
            <div className="flex-1 overflow-y-auto bg-gray-50 p-3 md:p-4">
              <div className="space-y-3 md:space-y-4">
                {messages[activeChannel].map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.userId === user.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 md:max-w-[80%] md:px-4 ${
                        message.userId === user.id
                          ? `bg-gradient-to-r ${currentChannel.color} text-white`
                          : 'bg-white shadow'
                      }`}
                    >
                      {message.userId !== user.id && (
                        <p className="mb-1 text-xs font-medium text-blue-600">
                          {message.username}
                        </p>
                      )}
                      <p className="text-sm">{message.content}</p>
                      <p className="mt-1 text-right text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </Tabs.Root>

          {/* Input - Adjusted for mobile */}
          <form onSubmit={sendMessage} className="border-t bg-white p-3 md:p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Message #${currentChannel.name.toLowerCase()}...`}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 md:text-base"
              />
              <Button
                type="submit"
                disabled={!newMessage.trim()}
                className={`bg-gradient-to-r ${currentChannel.color} hover:brightness-110`}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}