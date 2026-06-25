import { render, screen } from '@testing-library/react';
import BodyParamsCardPreview from '../components/BodyParamsCardPreview.jsx';

const SAMPLE_CARD = {
  name: 'Mohamed',
  locationName: 'kallakurichi',
  recordedDate: '2026-06-11',
  age: '23',
  gender: 'Male',
  heightCm: '143',
  weightKg: '50',
  bmi: '24.5',
  fatPercent: '16',
  bmr: '1648',
  bodyAge: '23',
};

describe('BodyParamsCardPreview', () => {
  it('renders canvas with bg.png background and the ticket card inside', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);

    const canvas = screen.getByTestId('body-params-share-canvas');
    const card   = screen.getByTestId('body-params-share-card');

    expect(canvas).toBeInTheDocument();
    expect(card).toBeInTheDocument();
    expect(canvas).toContainElement(card);

    expect(canvas).toHaveStyle({ background: '#f5f0e8' });
    expect(canvas).toHaveStyle({ backgroundImage: 'url(/bg.png)' });
    expect(canvas).toHaveStyle({ backgroundSize: 'cover' });
    expect(card).toHaveStyle({ border: '2px solid #166534' });
  });

  it('renders bg.png background and flower-icon.png at bottom-right', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);

    const canvas    = screen.getByTestId('body-params-share-canvas');
    const flowerImg = canvas.querySelector('img[src="/flower-icon.png"]');

    expect(flowerImg).toBeInTheDocument();
    expect(flowerImg).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders green header with logo and title', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);

    expect(screen.getByAltText('Wellness Valley')).toBeInTheDocument();
    expect(screen.getByText('Body Composition Metric')).toBeInTheDocument();
    expect(screen.queryByText('Wellness Evaluation Report')).not.toBeInTheDocument();
  });

  it('renders personal stats section without location or body-parameters title', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);

    expect(screen.queryByText('Your Body Parameters')).not.toBeInTheDocument();
    expect(screen.queryByText('kallakurichi')).not.toBeInTheDocument();
    expect(screen.getByText('Reference')).toBeInTheDocument();
  });

  it('renders personal stats as label : value rows', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);

    expect(screen.getByText('MOHAMED')).toBeInTheDocument();
    expect(screen.getByText('2026-06-11')).toBeInTheDocument();
    expect(screen.getAllByText('23 Yrs').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('143 cm')).toBeInTheDocument();
    expect(screen.getByText('50 kg')).toBeInTheDocument();
    expect(screen.getByText('ideal: 38.9 \u2013 47 kg')).toBeInTheDocument();
  });

  it('renders BMI metric with value in red oval when overweight', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);

    expect(screen.getByText('24.5')).toBeInTheDocument();
    expect(screen.getByText('(19 – 23)')).toBeInTheDocument();
    expect(screen.queryByText('OVERWEIGHT')).not.toBeInTheDocument();
  });

  it('renders BMI value in blue oval when within normal range', () => {
    render(<BodyParamsCardPreview card={{ ...SAMPLE_CARD, bmi: '21' }} />);

    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.queryByText('NORMAL')).not.toBeInTheDocument();
  });

  it('renders BMI value in red oval when underweight', () => {
    render(<BodyParamsCardPreview card={{ ...SAMPLE_CARD, bmi: '17' }} />);

    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.queryByText('UNDERWEIGHT')).not.toBeInTheDocument();
  });

  it('renders Fat% in oval with male range label, no badge', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);

    expect(screen.getByText('16%')).toBeInTheDocument();
    expect(screen.getByText('(10 – 20 %)')).toBeInTheDocument();
    expect(screen.queryByText('HEALTHY')).not.toBeInTheDocument();
  });

  it('renders Fat% in red oval when male fat% exceeds 20, no badge', () => {
    render(<BodyParamsCardPreview card={{ ...SAMPLE_CARD, fatPercent: '25' }} />);

    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.queryByText('HIGH FAT')).not.toBeInTheDocument();
  });

  it('renders Fat% in red oval when male fat% is below 10, no badge', () => {
    render(<BodyParamsCardPreview card={{ ...SAMPLE_CARD, fatPercent: '7' }} />);

    expect(screen.getByText('7%')).toBeInTheDocument();
    expect(screen.queryByText('LOW FAT')).not.toBeInTheDocument();
  });

  it('renders Fat% female range (20 – 30 %) for female gender, no badge', () => {
    render(<BodyParamsCardPreview card={{ ...SAMPLE_CARD, gender: 'female', fatPercent: '25' }} />);

    expect(screen.getByText('(20 – 30 %)')).toBeInTheDocument();
    expect(screen.queryByText('HEALTHY')).not.toBeInTheDocument();
  });

  it('renders BMR metric value, no badge', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);

    expect(screen.getByText('1648 kcal')).toBeInTheDocument();
    expect(screen.queryByText('GOOD')).not.toBeInTheDocument();
  });

  it('renders red rings for weight, BMI, and body age when all are out of range', () => {
    const { container } = render(<BodyParamsCardPreview card={{
      name: 'Test',
      recordedDate: '2026-06-17',
      age: '22',
      gender: 'male',
      heightCm: '176',
      weightKg: '88',
      bmi: '28.4',
      fatPercent: '15',
      bodyAge: '30',
    }} />);

    const redRings = container.querySelectorAll('circle[stroke="#ef4444"]');
    expect(redRings.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('88 kg')).toBeInTheDocument();
    expect(screen.getByText('28.4')).toBeInTheDocument();
    expect(screen.getByText('30 Yrs')).toBeInTheDocument();
  });

  it('renders Body Age value and ≤ age reference text, no badge text', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);

    expect(screen.getByText('Body Age')).toBeInTheDocument();
    expect(screen.getAllByText('23 Yrs').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('\u2264 23 Yrs')).toBeInTheDocument();
    expect(screen.queryByText('OPTIMAL')).not.toBeInTheDocument();
    expect(screen.queryByText('AGING')).not.toBeInTheDocument();
  });

  it('renders optional chest, waist, and hip measurements below body age', () => {
    render(<BodyParamsCardPreview card={{
      ...SAMPLE_CARD,
      chestCm: 95,
      waistCm: 82,
      hipCm: 98,
    }} />);

    expect(screen.getByText('95 cm')).toBeInTheDocument();
    expect(screen.getByText('82 cm')).toBeInTheDocument();
    expect(screen.getByText('98 cm')).toBeInTheDocument();
    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.getByText('Waist')).toBeInTheDocument();
    expect(screen.getByText('Hip')).toBeInTheDocument();
  });

  it('renders Wellness Valley footer', () => {
    render(<BodyParamsCardPreview card={SAMPLE_CARD} />);
    expect(screen.getByText('Wellness Valley')).toBeInTheDocument();
  });

  it('renders dashes for missing optional fields', () => {
    render(<BodyParamsCardPreview card={{
      name: 'Test', recordedDate: '', age: '', gender: '', heightCm: '', weightKg: '',
      bmi: '', fatPercent: '', bmr: '', bodyAge: '', locationName: '',
    }} />);

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});
