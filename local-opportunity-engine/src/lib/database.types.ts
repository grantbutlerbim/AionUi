import type { AiScore, Campaign, Contractor, MailPiece, Property, PropertyImage } from './types';

/**
 * Hand-written mirror of the Supabase schema (supabase/migrations/*.sql).
 * If the schema changes, regenerate with `supabase gen types typescript` instead.
 */
export type PropertyLatestScoreRow = {
  property_id: string;
  opportunity_type: string;
  ai_score_id: string;
  score: number;
  detected_issue: string | null;
  recommended_service: string | null;
  contractor_note: string | null;
  postcard_headline: string | null;
  postcard_body: string | null;
  est_job_value_low: number | null;
  est_job_value_high: number | null;
  model: string | null;
  scored_at: string;
};

export type Database = {
  public: {
    Tables: {
      properties: {
        Row: Property;
        Insert: Partial<Property> & Pick<Property, 'address' | 'city' | 'state' | 'zip'>;
        Update: Partial<Property>;
        Relationships: [];
      };
      property_images: {
        Row: PropertyImage;
        Insert: Partial<PropertyImage> & Pick<PropertyImage, 'property_id' | 'url'>;
        Update: Partial<PropertyImage>;
        Relationships: [];
      };
      ai_scores: {
        Row: AiScore;
        Insert: Partial<AiScore> & Pick<AiScore, 'property_id' | 'score'>;
        Update: Partial<AiScore>;
        Relationships: [];
      };
      contractors: {
        Row: Contractor;
        Insert: Partial<Contractor> & Pick<Contractor, 'name'>;
        Update: Partial<Contractor>;
        Relationships: [];
      };
      campaigns: {
        Row: Campaign;
        Insert: Partial<Campaign> & Pick<Campaign, 'name'>;
        Update: Partial<Campaign>;
        Relationships: [];
      };
      mail_pieces: {
        Row: MailPiece;
        Insert: Partial<MailPiece> & Pick<MailPiece, 'campaign_id' | 'property_id'>;
        Update: Partial<MailPiece>;
        Relationships: [];
      };
    };
    Views: {
      property_latest_scores: {
        Row: PropertyLatestScoreRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
};
