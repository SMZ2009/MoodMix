import React, { useState, useEffect } from 'react';
import { Users, MessageCircle, Heart, TrendingUp, Star, Coffee, Wine, Music, BookOpen, Palette, Flame, Droplets } from 'lucide-react';
import { getAllGroups } from '../engine/groupRecommendationEngine';
import { userStorage } from '../store/localStorageAdapter';

const iconMap = {
  Wine,
  Coffee,
  Flame,
  Droplets,
  Music,
  BookOpen,
  Palette
};

const DEMO_GROUPS = [
  {
    id: 1,
    name: '微醺夜话',
    description: '分享你的调酒故事，聊聊那些让人微醺的夜晚',
    memberCount: 128,
    onlineCount: 23,
    icon: Wine,
    color: 'from-purple-400 to-pink-400',
    tags: ['鸡尾酒', '夜生活', '故事'],
    recentMessages: [
      { user: '调酒师小王', content: '今晚调了一杯莫吉托，薄荷味道太清新了！', time: '2分钟前' },
      { user: '夜猫子', content: '有人试过用桂花糖浆代替普通糖浆吗？', time: '5分钟前' }
    ]
  },
  {
    id: 2,
    name: '咖啡时光',
    description: '咖啡爱好者的聚集地，分享你的咖啡日常',
    memberCount: 256,
    onlineCount: 45,
    icon: Coffee,
    color: 'from-amber-400 to-orange-400',
    tags: ['咖啡', '下午茶', '慢生活'],
    recentMessages: [
      { user: '拿铁女孩', content: '今天拉花成功了！虽然有点歪哈哈', time: '1分钟前' },
      { user: '手冲达人', content: '推荐一款埃塞俄比亚的豆子，果香浓郁', time: '8分钟前' }
    ]
  },
  {
    id: 3,
    name: '音乐酒馆',
    description: '边喝边听，分享你的音乐心情',
    memberCount: 89,
    onlineCount: 12,
    icon: Music,
    color: 'from-blue-400 to-cyan-400',
    tags: ['音乐', '爵士', '氛围'],
    recentMessages: [
      { user: '爵士迷', content: '今晚适合听Miles Davis', time: '3分钟前' },
      { user: '民谣青年', content: '有人去过后海的酒吧吗？', time: '10分钟前' }
    ]
  },
  {
    id: 4,
    name: '读书会',
    description: '一杯饮品，一本好书，一段静谧时光',
    memberCount: 67,
    onlineCount: 8,
    icon: BookOpen,
    color: 'from-emerald-400 to-teal-400',
    tags: ['阅读', '文学', '思考'],
    recentMessages: [
      { user: '书虫', content: '《百年孤独》配什么酒最好？', time: '15分钟前' },
      { user: '文艺青年', content: '推荐一本适合雨天读的书', time: '20分钟前' }
    ]
  },
  {
    id: 5,
    name: '创意调酒',
    description: '大胆尝试，创造属于你的特调',
    memberCount: 156,
    onlineCount: 34,
    icon: Palette,
    color: 'from-rose-400 to-red-400',
    tags: ['DIY', '创意', '实验'],
    recentMessages: [
      { user: '实验家', content: '用抹茶和伏特加调了一杯，味道很奇妙', time: '刚刚' },
      { user: '调酒新手', content: '求推荐适合女生的低度鸡尾酒配方', time: '4分钟前' }
    ]
  },
  {
    id: 6,
    name: '热门话题',
    description: '今日最火的饮品话题讨论',
    memberCount: 312,
    onlineCount: 89,
    icon: TrendingUp,
    color: 'from-violet-400 to-purple-400',
    tags: ['热门', '话题', '讨论'],
    recentMessages: [
      { user: '话题君', content: '大家觉得今年最火的饮品是什么？', time: '刚刚' },
      { user: '吃瓜群众', content: '某明星同款奶茶真的那么好喝吗？', time: '2分钟前' }
    ]
  }
];

const CommunitySection = ({ onNavigate, activeTab }) => {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [joinedGroups, setJoinedGroups] = useState(new Set());
  const [groups, setGroups] = useState(() => getAllGroups());
  const [totalUsers, setTotalUsers] = useState(0);

  // 获取真实UID用户总数
  useEffect(() => {
    const fetchTotalUsers = async () => {
      try {
        const userUID = userStorage.getUID();
        
        await fetch('/api/stats/register-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userUID })
        });

        const response = await fetch('/api/stats/total-users');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTotalUsers(data.totalUsers);
          }
        }
      } catch (error) {
        console.error('Failed to fetch total users:', error);
      }
    };

    fetchTotalUsers();
    // 每30秒刷新一次用户数量
    const interval = setInterval(fetchTotalUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinGroup = (groupId) => {
    setJoinedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  if (selectedGroup) {
    return (
      <GroupChat 
        group={selectedGroup} 
        onBack={() => setSelectedGroup(null)}
        isJoined={joinedGroups.has(selectedGroup.id)}
        onJoin={() => handleJoinGroup(selectedGroup.id)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-dreamy-gradient min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>
              社区
            </h1>
            <p className="text-sm text-gray-500 mt-1">加入群聊，与志同道合的朋友畅聊</p>
          </div>
          <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-full">
            <Users size={16} className="text-purple-600" />
            <span className="text-sm text-purple-700 font-medium">{totalUsers} 人</span>
          </div>
        </div>
      </div>

      {/* Group List */}
      <div className="flex-1 px-4 py-6 pb-24">
        <div className="grid grid-cols-1 gap-4">
          {groups.map((group) => (
            <GroupCard 
              key={group.id} 
              group={group} 
              onClick={() => setSelectedGroup(group)}
              isJoined={joinedGroups.has(group.id)}
              onJoin={(e) => {
                e.stopPropagation();
                handleJoinGroup(group.id);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const GroupCard = ({ group, onClick, isJoined, onJoin }) => {
  const Icon = iconMap[group.icon];
  
  if (!Icon) return null;
  
  return (
    <div 
      onClick={onClick}
      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/60 hover:shadow-md transition-all duration-300 cursor-pointer active:scale-[0.98]"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${group.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
          <Icon size={28} className="text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-lg" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>
              {group.name}
            </h3>
            <button
              onClick={onJoin}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isJoined 
                  ? 'bg-gray-100 text-gray-600' 
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              {isJoined ? '已加入' : '加入'}
            </button>
          </div>
          
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{group.description}</p>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {group.tags.map((tag, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                {tag}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Users size={12} />
              {group.memberCount} 成员
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              {group.onlineCount} 在线
            </span>
          </div>

          {/* Recent Messages Preview */}
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            {group.recentMessages.slice(0, 2).map((msg, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className="text-gray-500 font-medium flex-shrink-0">{msg.user}:</span>
                <span className="text-gray-400 truncate">{msg.content}</span>
                <span className="text-gray-300 flex-shrink-0 ml-auto">{msg.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const GroupChat = ({ group, onBack, isJoined, onJoin }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    ...group.recentMessages.map(m => ({ ...m, isMe: false })),
    { user: '系统', content: `欢迎来到 ${group.name}！`, time: '刚刚', isSystem: true }
  ]);

  const handleSend = () => {
    if (!message.trim()) return;
    
    setMessages(prev => [...prev, {
      user: '我',
      content: message,
      time: '刚刚',
      isMe: true
    }]);
    setMessage('');
  };

  const Icon = iconMap[group.icon];
  
  if (!Icon) return null;
  
  return (
    <div className="flex-1 flex flex-col bg-dreamy-gradient min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${group.color} flex items-center justify-center`}>
            <Icon size={20} className="text-white" />
          </div>
          
          <div className="flex-1">
            <h2 className="font-bold text-gray-800" style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}>
              {group.name}
            </h2>
            <p className="text-xs text-gray-500">{group.onlineCount} 人在线</p>
          </div>

          {!isJoined && (
            <button
              onClick={onJoin}
              className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-full hover:bg-purple-700 transition-colors"
            >
              加入群聊
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto pb-24">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
            {msg.isSystem ? (
              <div className="w-full text-center">
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.content}</span>
              </div>
            ) : (
              <div className={`max-w-[80%] ${msg.isMe ? 'bg-purple-600 text-white' : 'bg-white text-gray-800'} rounded-2xl px-4 py-2.5 shadow-sm`}>
                {!msg.isMe && (
                  <p className="text-xs text-gray-400 mb-1">{msg.user}</p>
                )}
                <p className="text-sm">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.isMe ? 'text-purple-200' : 'text-gray-400'}`}>{msg.time}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isJoined ? "输入消息..." : "加入群聊后即可发言"}
            disabled={!isJoined}
            className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!isJoined || !message.trim()}
            className="p-2.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommunitySection;
