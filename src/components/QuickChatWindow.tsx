import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Minimize2,
  Maximize2,
  Users,
  Building2,
  User,
  Search,
  CheckCheck,
  AlertCircle,
  Smile,
  ChevronDown,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { Employee, ZaloMessage } from '../types';

interface QuickChatWindowProps {
  currentUser: Employee;
  allEmployees?: Employee[];
  employees?: Employee[];
  messages?: ZaloMessage[];
  onSendMessage: (msg: ZaloMessage) => void;
  onMarkAsRead?: (msgId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  initialRecipientId?: string | null;
  defaultRecipientId?: string | null;
}

type ChatChannel = 'ALL' | 'DEPARTMENT' | 'DIRECT';

// Simple synthesized Web Audio chime for incoming messages (zero dependency, safe)
function playMessageChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // AudioContext might be blocked until user gesture, ignore silently
  }
}

export const QuickChatWindow: React.FC<QuickChatWindowProps> = ({
  currentUser,
  allEmployees: propAllEmployees,
  employees: propEmployees,
  messages = [],
  onSendMessage,
  onMarkAsRead,
  isOpen,
  onClose,
  initialRecipientId,
  defaultRecipientId,
}) => {
  const allEmployees = propAllEmployees || propEmployees || [];
  const effectiveRecipientId = initialRecipientId || defaultRecipientId;

  const [activeChannel, setActiveChannel] = useState<ChatChannel>('ALL');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [directSearch, setDirectSearch] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showChatSearch, setShowChatSearch] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesCountRef = useRef(messages.length);

  // Set initial direct recipient if requested
  useEffect(() => {
    if (effectiveRecipientId) {
      setActiveChannel('DIRECT');
      setSelectedPartnerId(effectiveRecipientId);
      setIsMinimized(false);
    }
  }, [effectiveRecipientId]);

  // Default partner for DIRECT channel if none selected
  useEffect(() => {
    if (activeChannel === 'DIRECT' && !selectedPartnerId) {
      const firstOther = allEmployees.find((e) => e.id !== currentUser.id);
      if (firstOther) {
        setSelectedPartnerId(firstOther.id);
      }
    }
  }, [activeChannel, selectedPartnerId, allEmployees, currentUser.id]);

  // Sound alert on new incoming message
  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      const latestMsg = messages[0];
      // If message is not from current user, play chime
      const isSentByMe =
        latestMsg.senderId === currentUser.id ||
        latestMsg.sentBy?.startsWith(currentUser.fullName);
      if (!isSentByMe && soundEnabled && isOpen) {
        playMessageChime();
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, currentUser, soundEnabled, isOpen]);

  // Selected colleague object for DIRECT chat
  const selectedPartner = useMemo(() => {
    return allEmployees.find((e) => e.id === selectedPartnerId);
  }, [allEmployees, selectedPartnerId]);

  // Filtered messages for the active conversation
  const currentConversationMessages = useMemo(() => {
    // Only non-scheduled messages or delivered messages
    const activeMsgs = messages.filter((m) => m.status !== 'SCHEDULED');

    if (activeChannel === 'ALL') {
      return activeMsgs.filter((m) => m.recipientType === 'ALL');
    }

    if (activeChannel === 'DEPARTMENT') {
      return activeMsgs.filter(
        (m) =>
          m.recipientType === 'DEPARTMENT' &&
          m.department?.toLowerCase() === (currentUser.department || '').toLowerCase()
      );
    }

    if (activeChannel === 'DIRECT' && selectedPartnerId) {
      return activeMsgs.filter((m) => {
        if (m.recipientType !== 'INDIVIDUAL') return false;
        const sentByMe =
          m.senderId === currentUser.id ||
          m.sentBy?.startsWith(currentUser.fullName);
        const sentByPartner =
          m.senderId === selectedPartnerId ||
          m.sentBy?.startsWith(selectedPartner?.fullName || '');

        const targetIsPartner = m.recipientIds?.includes(selectedPartnerId);
        const targetIsMe = m.recipientIds?.includes(currentUser.id);

        return (sentByMe && targetIsPartner) || (sentByPartner && targetIsMe);
      });
    }

    return [];
  }, [messages, activeChannel, currentUser, selectedPartnerId, selectedPartner]);

  // Sorted chronologically (oldest at top, newest at bottom for chat feel)
  const sortedMessages = useMemo(() => {
    return [...currentConversationMessages].sort((a, b) => {
      const timeA = new Date(a.sentAt.replace(' ', 'T')).getTime() || 0;
      const timeB = new Date(b.sentAt.replace(' ', 'T')).getTime() || 0;
      return timeA - timeB;
    });
  }, [currentConversationMessages]);

  // Live quick search filtering for active conversation
  const displayedMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) {
      return sortedMessages;
    }
    const q = chatSearchQuery.toLowerCase().trim();
    return sortedMessages.filter((m) => {
      const matchContent = m.content && m.content.toLowerCase().includes(q);
      const matchTitle = m.title && m.title.toLowerCase().includes(q);
      const matchSender = m.sentBy && m.sentBy.toLowerCase().includes(q);
      return matchContent || matchTitle || matchSender;
    });
  }, [sortedMessages, chatSearchQuery]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [sortedMessages.length, isOpen, isMinimized, activeChannel, selectedPartnerId]);

  // Mark visible unread messages as read
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    currentConversationMessages.forEach((m) => {
      const isReadByMe = m.readByIds?.includes(currentUser.id);
      if (!isReadByMe) {
        onMarkAsRead(m.id);
      }
    });
  }, [currentConversationMessages, currentUser.id, isOpen, isMinimized, onMarkAsRead]);

  // Unread badge counts per channel
  const unreadAllCount = useMemo(() => {
    return messages.filter(
      (m) =>
        m.status !== 'SCHEDULED' &&
        m.recipientType === 'ALL' &&
        (!m.readByIds || !m.readByIds.includes(currentUser.id))
    ).length;
  }, [messages, currentUser.id]);

  const unreadDeptCount = useMemo(() => {
    return messages.filter(
      (m) =>
        m.status !== 'SCHEDULED' &&
        m.recipientType === 'DEPARTMENT' &&
        m.department?.toLowerCase() === (currentUser.department || '').toLowerCase() &&
        (!m.readByIds || !m.readByIds.includes(currentUser.id))
    ).length;
  }, [messages, currentUser]);

  const unreadDirectCount = useMemo(() => {
    return messages.filter(
      (m) =>
        m.status !== 'SCHEDULED' &&
        m.recipientType === 'INDIVIDUAL' &&
        m.recipientIds?.includes(currentUser.id) &&
        (!m.readByIds || !m.readByIds.includes(currentUser.id))
    ).length;
  }, [messages, currentUser.id]);

  const totalUnreadCount = unreadAllCount + unreadDeptCount + unreadDirectCount;

  // Send message handler
  const handleSend = () => {
    if (!inputText.trim()) return;

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const content = inputText.trim();
    // Auto title: brief snippet
    const autoTitle = content.split('\n')[0].slice(0, 50) || 'Tin nhắn nhanh';

    let newMsg: ZaloMessage;

    if (activeChannel === 'ALL') {
      newMsg = {
        id: `chat-all-${Date.now()}`,
        type: 'BROADCAST',
        recipientType: 'ALL',
        recipientIds: allEmployees.map((e) => e.id),
        recipientNames: ['Toàn thể Công ty'],
        title: autoTitle,
        content,
        status: 'DELIVERED',
        sentAt: nowStr,
        isScheduled: false,
        priority: isUrgent ? 'URGENT' : 'NORMAL',
        readByIds: [currentUser.id],
        sentBy: `${currentUser.fullName} (${currentUser.position || 'Nhân sự'})`,
        senderId: currentUser.id,
        znsMessageId: `CHAT-${Date.now().toString().slice(-6)}`,
      };
    } else if (activeChannel === 'DEPARTMENT') {
      const deptMembers = allEmployees.filter(
        (e) => e.department === currentUser.department
      );
      newMsg = {
        id: `chat-dept-${Date.now()}`,
        type: 'INDIVIDUAL',
        recipientType: 'DEPARTMENT',
        department: currentUser.department,
        recipientIds: deptMembers.map((e) => e.id),
        recipientNames: [`Ca: ${currentUser.department}`],
        title: autoTitle,
        content,
        status: 'DELIVERED',
        sentAt: nowStr,
        isScheduled: false,
        priority: isUrgent ? 'URGENT' : 'NORMAL',
        readByIds: [currentUser.id],
        sentBy: `${currentUser.fullName} (${currentUser.position || 'Nhân sự'})`,
        senderId: currentUser.id,
        znsMessageId: `CHAT-${Date.now().toString().slice(-6)}`,
      };
    } else {
      if (!selectedPartner) return;
      newMsg = {
        id: `chat-dm-${Date.now()}`,
        type: 'INDIVIDUAL',
        recipientType: 'INDIVIDUAL',
        recipientIds: [selectedPartner.id],
        recipientNames: [selectedPartner.fullName],
        title: autoTitle,
        content,
        status: 'DELIVERED',
        sentAt: nowStr,
        isScheduled: false,
        priority: isUrgent ? 'URGENT' : 'NORMAL',
        readByIds: [currentUser.id],
        sentBy: `${currentUser.fullName} (${currentUser.position || 'Nhân sự'})`,
        senderId: currentUser.id,
        znsMessageId: `CHAT-${Date.now().toString().slice(-6)}`,
      };
    }

    onSendMessage(newMsg);
    setInputText('');
    setIsUrgent(false);
    setShowEmojiPicker(false);

    // Auto focus back on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickEmojis = ['👍', '🆗', '✅', '⚠️', '🚨', '🙏', '👏', '🎯'];

  const filteredColleagues = useMemo(() => {
    return allEmployees.filter((e) => {
      if (e.id === currentUser.id) return false;
      if (!directSearch.trim()) return true;
      const q = directSearch.toLowerCase();
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q)
      );
    });
  }, [allEmployees, currentUser.id, directSearch]);

  if (!isOpen) return null;

  // Minimized floating bar view
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-fadeIn">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl shadow-xl border border-indigo-400/40 transition-all group"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 text-white" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full border-2 border-indigo-600 animate-pulse">
                {totalUnreadCount}
              </span>
            )}
          </div>
          <div className="text-left">
            <div className="text-xs font-bold leading-tight">Cửa Sổ Chat Nhanh</div>
            <div className="text-[10px] text-indigo-100">
              {activeChannel === 'ALL'
                ? 'Kênh Toàn thể'
                : activeChannel === 'DEPARTMENT'
                ? `Ca: ${currentUser.department}`
                : selectedPartner?.fullName || 'Trực tiếp'}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-indigo-200 group-hover:rotate-180 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 transition-all duration-200 flex flex-col bg-white border border-slate-200 shadow-2xl overflow-hidden ${
        isExpanded
          ? 'inset-3 sm:inset-10 md:inset-16 rounded-3xl'
          : 'bottom-4 right-4 w-[95vw] sm:w-[460px] h-[580px] max-h-[90vh] rounded-3xl'
      }`}
    >
      {/* Chat Window Top Bar Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-indigo-200">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wide">Cửa Sổ Chat Nhanh</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-medium border border-emerald-400/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Realtime
              </span>
            </div>
            <p className="text-[10px] text-slate-300">
              Nhận, đọc và phản hồi tin tức vận hành tức thì
            </p>
          </div>
        </div>

        {/* Window action buttons */}
        <div className="flex items-center gap-1 text-slate-300">
          <button
            onClick={() => {
              setShowChatSearch((prev) => !prev);
              if (showChatSearch) setChatSearchQuery('');
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              showChatSearch || chatSearchQuery
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-white/10 text-slate-300'
            }`}
            title="Tìm kiếm nhanh tin nhắn"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title={soundEnabled ? 'Tắt âm báo tin nhắn' : 'Bật âm báo tin nhắn'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-300" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors hidden sm:block"
            title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Thu xuống thanh đáy"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors"
            title="Đóng cửa sổ chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Channel Switcher Tabs */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-1.5 shrink-0 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {/* ALL Tab */}
          <button
            onClick={() => setActiveChannel('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeChannel === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Toàn thể</span>
            {unreadAllCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                {unreadAllCount}
              </span>
            )}
          </button>

          {/* DEPT Tab */}
          <button
            onClick={() => setActiveChannel('DEPARTMENT')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeChannel === 'DEPARTMENT'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Ca: {currentUser.department}</span>
            {unreadDeptCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                {unreadDeptCount}
              </span>
            )}
          </button>

          {/* DIRECT Tab */}
          <button
            onClick={() => setActiveChannel('DIRECT')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeChannel === 'DIRECT'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Trực tiếp 1-1</span>
            {unreadDirectCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                {unreadDirectCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sub-header for DIRECT Channel (Colleague Selector) */}
      {activeChannel === 'DIRECT' && (
        <div className="bg-indigo-50/60 border-b border-indigo-100 p-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
            >
              {filteredColleagues.map((colleague) => (
                <option key={colleague.id} value={colleague.id}>
                  {colleague.fullName} — {colleague.position} ({colleague.department})
                </option>
              ))}
            </select>
          </div>

          {selectedPartner && (
            <div className="flex items-center gap-2 shrink-0">
              <img
                src={selectedPartner.avatar}
                alt={selectedPartner.fullName}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200"
              />
            </div>
          )}
        </div>
      )}

      {/* Active Conversation Channel Info Banner */}
      <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold text-slate-700">
            {activeChannel === 'ALL' && 'Phòng chat chung toàn thể công ty'}
            {activeChannel === 'DEPARTMENT' && `Kênh trao đổi ca trực: ${currentUser.department}`}
            {activeChannel === 'DIRECT' &&
              selectedPartner &&
              `Nhắn tin riêng với ${selectedPartner.fullName} (${selectedPartner.position})`}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">
          {chatSearchQuery.trim()
            ? `${displayedMessages.length}/${sortedMessages.length} tin`
            : `${sortedMessages.length} tin nhắn`}
        </span>
      </div>

      {/* Quick Search Bar */}
      {showChatSearch && (
        <div className="bg-indigo-50/90 border-b border-indigo-100 px-3 py-2 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-indigo-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              placeholder="Tìm nhanh nội dung, từ khóa, người gửi..."
              autoFocus
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-2xs"
            />
            {chatSearchQuery && (
              <button
                type="button"
                onClick={() => setChatSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="text-[11px] font-bold text-indigo-700 whitespace-nowrap">
            {chatSearchQuery.trim()
              ? `${displayedMessages.length} kết quả`
              : `${sortedMessages.length} tin`}
          </div>
        </div>
      )}

      {/* Messages Scrollable Body Container */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-gradient-to-b from-slate-50/40 via-white to-white">
        {displayedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
            {chatSearchQuery.trim() ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500">
                  <Search className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-700">Không tìm thấy tin nhắn nào</div>
                <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                  Không có tin nhắn nào khớp với từ khóa "{chatSearchQuery}".
                </p>
                <button
                  type="button"
                  onClick={() => setChatSearchQuery('')}
                  className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Xóa từ khóa tìm kiếm
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-400">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-slate-700">Chưa có tin nhắn trong kênh này</div>
                <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                  Hãy nhập tin nhắn bên dưới và bấm gửi để bắt đầu kết nối trực tiếp với đồng nghiệp!
                </p>
              </>
            )}
          </div>
        ) : (
          displayedMessages.map((msg) => {
            const isMe =
              msg.senderId === currentUser.id ||
              msg.sentBy?.startsWith(currentUser.fullName);
            const isUrgentMsg = msg.priority === 'URGENT';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
              >
                {/* Sender Tag if from others */}
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-bold text-slate-700">{msg.sentBy}</span>
                    {msg.department && (
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded font-medium">
                        {msg.department}
                      </span>
                    )}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs transition-all ${
                    isMe
                      ? isUrgentMsg
                        ? 'bg-rose-600 text-white rounded-tr-xs shadow-rose-200'
                        : 'bg-indigo-600 text-white rounded-tr-xs shadow-indigo-100'
                      : isUrgentMsg
                      ? 'bg-rose-50 text-rose-950 border border-rose-200 rounded-tl-xs'
                      : 'bg-slate-100 text-slate-800 border border-slate-200/80 rounded-tl-xs'
                  }`}
                >
                  {isUrgentMsg && (
                    <div
                      className={`flex items-center gap-1 text-[10px] font-extrabold mb-1 ${
                        isMe ? 'text-amber-200' : 'text-rose-700'
                      }`}
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>THÔNG BÁO KHẨN CẤP</span>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                  {/* Timestamp & status info */}
                  <div
                    className={`flex items-center justify-end gap-1.5 mt-1 text-[9px] ${
                      isMe ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.sentAt.split(' ')[1] || msg.sentAt}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-indigo-200" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reaction Pills Bar */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar shrink-0 text-xs">
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider hidden sm:inline mr-1">
            Nhanh:
          </span>
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setInputText((prev) => (prev ? `${prev} ${emoji}` : emoji))}
              className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Priority Toggle */}
        <button
          type="button"
          onClick={() => setIsUrgent(!isUrgent)}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shrink-0 ${
            isUrgent
              ? 'bg-rose-500 text-white shadow-2xs animate-pulse'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
          title="Đánh dấu tin khẩn cấp"
        >
          <AlertCircle className="w-3 h-3" />
          <span>{isUrgent ? 'Khẩn cấp' : 'Ưu tiên'}</span>
        </button>
      </div>

      {/* Message Input & Send Controls Form */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Nhập tin nhắn ${
                activeChannel === 'ALL'
                  ? 'gửi toàn thể...'
                  : activeChannel === 'DEPARTMENT'
                  ? `gửi ca ${currentUser.department}...`
                  : `gửi ${selectedPartner?.fullName || 'đồng nghiệp'}...`
              } (Nhấn Enter để gửi)`}
              className="w-full px-3.5 py-2 rounded-2xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed"
            />
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`p-3 rounded-2xl font-bold shadow-md transition-all shrink-0 flex items-center justify-center ${
              inputText.trim()
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
            title="Gửi tin nhắn (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
