import { daily, dateFromKey } from '@/lib/daily';

export type MajorityQuestion = {
  prompt: string;
  kind: 'colors' | 'shapes' | 'patterns';
  options: string[][];
};

export const majorityQuestions: MajorityQuestion[] = [
  {
    prompt: '가장 많은 사람이 고를 색 조합은?',
    kind: 'colors',
    options: [
      ['#FF5E5B', '#FFD13D', '#231D4B'],
      ['#2DCEA2', '#FCFBFF', '#4B5BFF'],
      ['#FF8BC6', '#8C6BFF', '#FFD13D'],
      ['#D9C7A7', '#5B4636', '#F1ECE1'],
    ],
  },
  {
    prompt: '가장 많은 사람이 고를 모양은?',
    kind: 'shapes',
    options: [['circle'], ['star'], ['round'], ['heart']],
  },
  {
    prompt: '가장 많은 사람이 고를 무늬는?',
    kind: 'patterns',
    options: [['stripe'], ['dot'], ['check'], ['burst']],
  },
];

export function majorityOrder(key: string, index: number): number[] {
  const rand = daily(12, dateFromKey(key));
  for (let skip = 0; skip < index * 4; skip += 1) rand();
  const items = [0, 1, 2, 3];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}
