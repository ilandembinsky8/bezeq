import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface IBmasterProps {
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  PageType: string;
  SlideShowInteval: string;
  context: WebPartContext;
}