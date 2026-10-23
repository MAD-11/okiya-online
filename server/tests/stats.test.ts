import { calculateNewRatings } from '../src/stats';

describe('ELO', () => {
  test('равные рейтинги, победа A → A растёт, B падает', () => {
    const { newA, newB } = calculateNewRatings(1000, 1000, 1);
    expect(newA).toBeGreaterThan(1000);
    expect(newB).toBeLessThan(1000);
  });

  test('ничья при равных рейтингах → без изменений', () => {
    const { newA, newB } = calculateNewRatings(1000, 1000, 0.5);
    expect(newA).toBe(1000);
    expect(newB).toBe(1000);
  });

  test('андердог выигрывает → большой прирост', () => {
    const { newA } = calculateNewRatings(800, 1200, 1);
    expect(newA - 800).toBeGreaterThan(20);
  });

  test('фаворит выигрывает → маленький прирост', () => {
    const { newA } = calculateNewRatings(1200, 800, 1);
    expect(newA - 1200).toBeLessThan(20);
  });
});