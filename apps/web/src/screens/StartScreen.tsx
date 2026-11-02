// شاشة البداية: ترحيب صوتي، زر واحد كبير للدرس، النجوم، ورابط صغير للكبار
import { useEffect, useState } from 'react';
import { navigate } from '../App';
import { countStars, getSetting } from '../data/repo';
import { primeAudio, say } from '../audio/audio';
import { SHARED_AUDIO_TEXTS } from '../content/lessons/L1A-01';
import { toArabicIndic } from '../engine/answers';

export function StartScreen() {
  const [stars, setStars] = useState(0);
  const [childName, setChildName] = useState('غيث');

  useEffect(() => {
    countStars().then(setStars).catch(() => undefined);
    getSetting<string>('childName', 'غيث').then(setChildName).catch(() => undefined);
  }, []);

  const start = () => {
    primeAudio();
    void say('ui.welcome', SHARED_AUDIO_TEXTS['ui.welcome']);
    navigate('/lesson/L1A-01');
  };

  return (
    <main className="screen screen-center">
      <h1 className="title">أهلًا {childName}!</h1>
      <p className="subtitle">درس اليوم: لوحة المائة</p>
      <div className="stars" aria-label={`نجومك: ${toArabicIndic(stars)}`}>
        {'★'.repeat(Math.min(stars, 10))} {stars > 10 ? toArabicIndic(stars) : ''}
      </div>
      <div className="button-row">
        <button type="button" className="big-button" onClick={start} autoFocus>
          ▶ ابدأ
        </button>
        <button type="button" className="big-button secondary" onClick={() => void say('ui.welcome', SHARED_AUDIO_TEXTS['ui.welcome'])}>
          🔊 اسمع
        </button>
      </div>
      <button type="button" className="small-link" onClick={() => navigate('/parent')}>
        للكبار
      </button>
    </main>
  );
}
