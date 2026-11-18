/** 게시자 ID로 ads.txt 한 줄을 만든다. 슬롯 ID는 여기 없다. */
export function adsTxtLine(client: string | undefined): string | null {
  const pub = (client ?? '').replace(/^ca-/, '');
  if (!/^pub-\d{10,20}$/.test(pub)) return null;
  return `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`;
}
