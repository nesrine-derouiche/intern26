import { RelativeTimePipe } from './relative-time.pipe';

describe('RelativeTimePipe', () => {
  let pipe: RelativeTimePipe;

  beforeEach(() => {
    pipe = new RelativeTimePipe();
  });

  it('should return empty string for null/undefined', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should return empty string for invalid date', () => {
    expect(pipe.transform('not-a-date')).toBe('');
  });

  it('should return "À l\'instant" for less than a minute', () => {
    expect(pipe.transform(new Date(Date.now() - 30 * 1000))).toBe("À l'instant");
  });

  it('should return minutes for less than an hour', () => {
    expect(pipe.transform(new Date(Date.now() - 5 * 60 * 1000))).toBe('Il y a 5 min');
  });

  it('should return hours for less than a day', () => {
    expect(pipe.transform(new Date(Date.now() - 4 * 3600 * 1000))).toBe('Il y a 4 h');
  });

  it('should return "Hier" for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(pipe.transform(yesterday)).toBe('Hier');
  });

  it('should return days for less than a week', () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    expect(pipe.transform(d)).toBe('Il y a 3 j');
  });

  it('should return weeks for less than 5 weeks', () => {
    const d = new Date();
    d.setDate(d.getDate() - 21);
    expect(pipe.transform(d)).toBe('Il y a 3 sem.');
  });

  it('should return formatted date for older dates', () => {
    expect(pipe.transform('2026-05-01T09:00:00')).toBe('01/05/2026');
  });
});
