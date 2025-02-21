export interface VersusGameSettings {
  bettingEnabled: boolean;
  defaultDuration: number; // in hours
}

export interface TeamBet {
  userId: string;
  amount: number;
  team: 1 | 2;
}

export interface VersusGame {
  id: string;
  status: string;
  teams: {
    team1: string;
    team2: string;
    team1Image: string;
    team2Image: string;
    bannerImage: string;
  };
  odds: {
    team1: number;
    team2: number;
  };
  bets: TeamBet[];
  totalBets: number;
  createdAt: Date;
  endTime?: Date;
  bettingEnabled?: boolean;
}