/**
 * MarathonLeaderCard.test.jsx — Snapshot + render tests for premium leader cards.
 */
import React                from 'react';
import { render, screen }   from '@testing-library/react';
import MarathonLeaderCard   from '../components/MarathonLeaderCard.jsx';

const DAY_CARD = {
  cardType:    'day_leader',
  marathonName: 'Team BalajiLeenah 12',
  lapNumber:   7,
  dayNumber:   1,
  dayLeader: {
    userId:              5,
    name:                'Vasantha',
    profileImage:        null,
    dailyChange:         -0.7,
    dailyChangeDisplay:  '-0.70 KG',
  },
  lapLeader: null,
};

const LAP_CARD = {
  cardType:    'lap_leader',
  marathonName: 'Team BalajiLeenah 12',
  lapNumber:   7,
  dayNumber:   1,
  lapLeader: {
    userId:             5,
    name:               'Vasantha',
    profileImage:       null,
    lapChange:          -0.7,
    lapChangeDisplay:   '-0.70 KG',
  },
  dayLeader: null,
};

describe('MarathonLeaderCard — Day Leader', () => {
  it('renders the winner name', () => {
    render(<MarathonLeaderCard card={DAY_CARD} />);
    expect(screen.getByText('Vasantha')).toBeInTheDocument();
  });

  it('renders "DAY LEADER" title', () => {
    render(<MarathonLeaderCard card={DAY_CARD} />);
    expect(screen.getByText('DAY LEADER')).toBeInTheDocument();
  });

  it('renders the lap + day badge', () => {
    render(<MarathonLeaderCard card={DAY_CARD} />);
    expect(screen.getByText(/Lap 7/)).toBeInTheDocument();
  });

  it('renders the weight loss metric', () => {
    render(<MarathonLeaderCard card={DAY_CARD} />);
    expect(screen.getByText('-0.70 KG')).toBeInTheDocument();
  });

  it('renders the marathon name', () => {
    render(<MarathonLeaderCard card={DAY_CARD} />);
    expect(screen.getByText('Team BalajiLeenah 12')).toBeInTheDocument();
  });

  it('renders the reduction label', () => {
    render(<MarathonLeaderCard card={DAY_CARD} />);
    expect(screen.getByText('Weight loss for this day')).toBeInTheDocument();
  });

  it('renders an initial avatar when profileImage is null', () => {
    render(<MarathonLeaderCard card={DAY_CARD} />);
    // Initial avatar shows "V" for Vasantha
    expect(screen.getByText('V')).toBeInTheDocument();
  });

  it('renders null gracefully', () => {
    const { container } = render(<MarathonLeaderCard card={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('MarathonLeaderCard — Lap Leader', () => {
  it('renders "LAP LEADER" title', () => {
    render(<MarathonLeaderCard card={LAP_CARD} />);
    expect(screen.getByText('LAP LEADER')).toBeInTheDocument();
  });

  it('renders the lap reduction label', () => {
    render(<MarathonLeaderCard card={LAP_CARD} />);
    expect(screen.getByText('Weight loss for this lap')).toBeInTheDocument();
  });
});

describe('MarathonLeaderCard — with profile image', () => {
  it('renders an img element when profileImage is provided', () => {
    const cardWithImage = {
      ...DAY_CARD,
      dayLeader: { ...DAY_CARD.dayLeader, profileImage: 'data:image/png;base64,abc' },
    };
    render(<MarathonLeaderCard card={cardWithImage} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc');
    expect(img).toHaveAttribute('alt', 'Vasantha');
  });
});
