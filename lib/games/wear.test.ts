import { describe, expect, it } from 'vitest';
import { colderOutfit, wearBand, wearOutfit, wearOutfits, wearStyleOfDay, wearStyles } from '@/content/wear';
import { wearDefault, wearSidos, wearSpot, wearSpotsIn } from '@/content/wear-points';
import { chores, forecastBases, gridOf, readVillage, swingText, villageUrl, type FcstItem } from './wear';

describe('오늘 뭐 입지', () => {
  it('서울시청은 기상청 격자 60, 127이다', () => {
    expect(gridOf(37.5663, 126.9784)).toEqual({ nx: 60, ny: 127 });
  });

  it('발표 10분 전의 기준시각은 이전 발표를 쓴다', () => {
    expect(forecastBases(new Date('2026-11-15T08:09:00+09:00'))[0]).toEqual({ date: '20261115', time: '0500' });
    expect(forecastBases(new Date('2026-11-15T08:10:00+09:00'))[0]).toEqual({ date: '20261115', time: '0800' });
    expect(forecastBases(new Date('2026-11-15T01:30:00+09:00'))[0]).toEqual({ date: '20261114', time: '2300' });
  });

  it('예보 항목에서 기온과 강수확률만 고른다', () => {
    const items: FcstItem[] = [
      { category: 'TMP', fcstDate: '20261115', fcstTime: '0900', fcstValue: '8' },
      { category: 'TMP', fcstDate: '20261115', fcstTime: '1200', fcstValue: '14' },
      { category: 'TMP', fcstDate: '20261115', fcstTime: '1500', fcstValue: '13' },
      { category: 'TMN', fcstDate: '20261115', fcstTime: '0600', fcstValue: '4' },
      { category: 'TMX', fcstDate: '20261115', fcstTime: '1500', fcstValue: '15' },
      { category: 'POP', fcstDate: '20261115', fcstTime: '0900', fcstValue: '20' },
      { category: 'POP', fcstDate: '20261115', fcstTime: '1500', fcstValue: '60' },
      { category: 'TMP', fcstDate: '20261116', fcstTime: '0900', fcstValue: '99' },
    ];
    const facts = readVillage(items, new Date('2026-11-15T11:20:00+09:00'));
    expect(facts).toMatchObject({ temp: 14, low: 4, high: 15, pop: 60 });
    expect(facts?.hours.map((hour) => hour.hour)).toEqual([9, 12, 15]);
    expect(wearBand(14)?.id).toBe(11);
    expect(wearOutfit(14, 'f', 'casual').main).toBe('셔츠 재킷 + 롱스커트');
    expect(swingText(4, 15)).toContain('일교차 11°');
    expect(chores(60)?.find((job) => job.name === '우산')?.text).toBe('챙기세요 60%');
    expect(chores(10)?.find((job) => job.name === '빨래')?.text).toBe('잘 말라요');
    expect(chores(null)).toBeNull();
  });

  it('기온 20단계와 여남 스타일 5가지가 200벌이다', () => {
    expect(wearOutfits).toHaveLength(200);
    const keys = new Set(wearOutfits.map((item) => `${item.band}:${item.gender}:${item.style}`));
    expect(keys.size).toBe(200);
    expect(wearBand(33)?.id).toBe(1);
    expect(wearBand(32)?.id).toBe(2);
    expect(wearBand(-4)?.id).toBe(20);
    expect(wearBand(-10)?.id).toBe(20);
    for (const style of wearStyles) {
      const women = wearOutfit(14, 'f', style.key).items.join('|');
      const men = wearOutfit(14, 'm', style.key).items.join('|');
      expect(women).not.toBe(men);
    }
    expect(colderOutfit(14, 'f', 'casual')?.band).toBe(12);
    expect(colderOutfit(-10, 'f', 'casual')).toBeNull();
    const morning = wearStyleOfDay(new Date('2026-11-15T08:00:00+09:00'));
    const evening = wearStyleOfDay(new Date('2026-11-15T21:00:00+09:00'));
    expect(morning).toBe(evening);
    expect(wearStyles.map((item) => item.key)).toContain(morning);
  });

  it('시군구는 기상청 동네예보 지점이고 경남은 창원만 있지 않다', () => {
    expect(wearSidos).toHaveLength(17);
    const gyeongnam = wearSpotsIn('경남');
    expect(gyeongnam.length).toBeGreaterThan(10);
    expect(gyeongnam.map((item) => item.name)).toContain('진주시');
    expect(wearDefault('경남')?.name.startsWith('창원')).toBe(true);
    expect(wearSpot('1111000000')).toMatchObject({ name: '종로구', nx: 60, ny: 127 });
    expect(wearSpotsIn('제주').map((item) => item.name).sort()).toEqual(['서귀포시', '제주시']);
  });

  it('서비스 키는 한 번만 인코딩한다', () => {
    const url = villageUrl('abc+def/ghi=', { nx: '60', ny: '127', base_date: '20261115', base_time: '0800' });
    expect(url).toContain('serviceKey=abc%2Bdef%2Fghi%3D');
    expect(url).not.toContain('%252B');
    const encoded = villageUrl('abc%2Bdef%2Fghi%3D', { nx: '60', ny: '127', base_date: '20261115', base_time: '0800' });
    expect(encoded).toContain('serviceKey=abc%2Bdef%2Fghi%3D');
    expect(encoded).not.toContain('%252B');
  });
});
