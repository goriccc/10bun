'use client';

import { useState } from 'react';
import { regions } from '@/content/regions';
import type { DeviceProfile } from '@/lib/device';
import { errorText } from '@/lib/errors';

export function ProfileForm({
  profile,
  regionsOnly,
  onSave,
}: {
  profile: DeviceProfile;
  regionsOnly?: boolean;
  onSave: (next: DeviceProfile) => Promise<{ ok?: boolean; code?: string }>;
}) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [region, setRegion] = useState(regionsOnly && profile.region === '미정' ? '서울' : profile.region);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <form
      className="panel profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        void onSave({ nickname: nickname.trim(), region }).then((data) => {
          setPending(false);
          setMessage(data.ok ? '저장했어요.' : errorText(data.code ?? 'bad_request'));
        });
      }}
    >
      {regionsOnly ? null : (
        <label className="field">
          별명
          <input className="inp" value={nickname} maxLength={8} onChange={(event) => setNickname(event.target.value)} />
        </label>
      )}
      <label className="field">
        시도
        <select className="inp" value={region} onChange={(event) => setRegion(event.target.value)}>
          {regionsOnly ? null : <option value="미정">미정</option>}
          {regions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div className="profile-form-actions">
        <button className="btn sm" type="submit" disabled={pending}>
          저장
        </button>
      </div>
      {message ? <p className="hint">{message}</p> : null}
    </form>
  );
}
