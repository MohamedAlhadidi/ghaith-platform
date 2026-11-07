// شاشة البداية: الأفاتار والرفيق يرحبان، زر واحد كبير للعبة، النجوم، استئناف جلسة منقطعة، وزر التحديث
import { useEffect, useState } from 'react';
import { navigate } from '../App';
import { countStars, getProfile, loadResume, type ChildProfile, DEFAULT_PROFILE } from '../data/repo';
import { primeAudio, say, setVoiceEnabled } from '../audio/audio';
import { LESSON_L1A_01 } from '../content/lessons/L1A-01';
import { toArabicIndic } from '../engine/answers';
import { GhaithAvatar } from '../avatar/GhaithAvatar';
import { Companion } from '../avatar/Companion';
import { applyUpdate, onUpdateAvailable } from '../pwa/update';

export function StartScreen() {
  const [stars, setStars] = useState(0);
  const [profile, setProfile] = useState<ChildProfile>(DEFAULT_PROFILE);
  const [resumable, setResumable] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    countStars().then(setStars).catch(() => undefined);
    getProfile()
      .then((p) => {
        setProfile(p);
        setVoiceEnabled(p.voiceEnabled);
      })
      .catch(() => undefined);
    loadResume()
      .then((r) => setResumable(Boolean(r)))
      .catch(() => undefined);
    return onUpdateAvailable(setUpdateReady);
  }, []);

  const welcome = `أهلًا ${profile.name}! ${resumable ? 'نكمل من حيث توقفنا؟' : 'جاهز للكنز؟'}`;

  const start = () => {
    primeAudio();
    navigate(`/lesson/${LESSON_L1A_01.code}`);
  };

  return (
    <main className="screen screen-center" data-stage="start">
      <GhaithAvatar look={profile.avatarLook ?? 'explorer'} size={150} state="idle" />
      <h1 className="title">{profile.name}</h1>
      <Companion textAr={welcome} mood="talk" onReplay={() => void say(welcome)} />
      <p className="subtitle">لعبة اليوم: {LESSON_L1A_01.gameTitleAr}</p>
      <div className="stars" aria-label={`نجومك: ${toArabicIndic(stars)}`}>
        {'★'.repeat(Math.min(stars, 10))} {stars > 10 ? toArabicIndic(stars) : ''}
      </div>
      <div className="button-row">
        <button type="button" className="big-button" onClick={start} autoFocus data-testid="start">
          {resumable ? 'نكمل' : 'ابدأ'}
        </button>
      </div>
      <div className="button-row">
        <button type="button" className="small-link" onClick={() => navigate('/parent')}>
          للكبار
        </button>
        {updateReady && (
          <button type="button" className="small-link" onClick={() => void applyUpdate()}>
            يوجد تحديث: اضغط للتحديث
          </button>
        )}
      </div>
    </main>
  );
}
