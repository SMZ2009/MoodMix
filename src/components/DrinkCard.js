import React from 'react';
import { HeartOff, Heart, Wine, Droplets, ThermometerSnowflake, GlassWater, Flame } from 'lucide-react';
import { useTouchFeedback } from '../hooks/useTouchFeedback';
import { InteractiveButton } from './ui';

const iconMap = {
  Wine,
  Droplets,
  ThermometerSnowflake,
  GlassWater,
  Flame
};

const DrinkCard = ({ drink, isActive, onClick, onLike, onUnlike }) => {
  const {
    style: cardStyle,
    getEventHandlers
  } = useTouchFeedback({
    scale: 0.96,
    duration: 200
  });

  const eventHandlers = getEventHandlers();

  return (
    <div
      onClick={onClick}
      className={`flex-none px-3 transition-all duration-500 transform ${
        isActive ? 'scale-100 opacity-100 z-10' : 'scale-[0.85] opacity-30 grayscale-[30%] z-0'
      }`}
      style={{
        ...cardStyle,
        maxWidth: '75vw',
        minWidth: 0
      }}
      role="button"
      tabIndex={0}
      onMouseDown={eventHandlers.onMouseDown}
      onMouseUp={eventHandlers.onMouseUp}
      onMouseLeave={eventHandlers.onMouseLeave}
      onTouchStart={eventHandlers.onTouchStart}
      onTouchEnd={eventHandlers.onTouchEnd}
      onTouchCancel={eventHandlers.onTouchCancel}
      onKeyDown={eventHandlers.onKeyDown}
      onKeyUp={eventHandlers.onKeyUp}
    >
      <div className="relative aspect-[3/4.5] rounded-[2.8rem] overflow-hidden shadow-[0_25px_60px_-12px_rgba(0,0,0,0.22)] bg-white border border-black/[0.02]" style={{ minWidth: 0, width: '100%' }}>
        <img src={drink.image} className="w-full h-full object-cover" alt={drink.name} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/85" />
        
        <div className="absolute top-6 left-6">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full flex items-center gap-2 text-white/90 text-[11px] font-bold tracking-wide">
            {React.createElement(iconMap[drink.briefIngredients[0].icon], { size: 14, className: "opacity-80 text-blue-300" })}
            {drink.abv > 0 ? `微醺 | ABV ${drink.abv}%` : '无酒精'}
          </div>
        </div>
        
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-10 px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-3 tracking-tight leading-none drop-shadow-md">{drink.name}</h2>
          <p className="text-[12px] text-white/70 leading-relaxed font-light mb-6 max-w-[220px] line-clamp-2">{drink.reason}</p>
          
          <div className="flex items-center gap-5 mb-8">
            {drink.briefIngredients.map((ing, bIdx) => {
              const BriefIcon = iconMap[ing.icon];
              return (
                <div key={bIdx} className="flex flex-col items-center gap-1.5">
                  <div className="text-white/90">
                    <BriefIcon size={20} strokeWidth={2.5} />
                  </div>
                  <span className="text-[9px] font-black text-white/30 tracking-[0.2em] uppercase leading-none">{ing.label}</span>
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between w-full px-3 gap-3">
            <InteractiveButton
              variant="icon"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                if (onUnlike) onUnlike(drink.id);
              }}
              style={{
                width: '44px',
                height: '44px',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)'
              }}
            >
              <HeartOff size={20} />
            </InteractiveButton>
            <InteractiveButton
              variant="icon"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onLike(drink.id);
              }}
              style={{
                width: '44px',
                height: '44px',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                color: '#FF7675'
              }}
            >
              <Heart size={20} className="fill-current" />
            </InteractiveButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrinkCard;
