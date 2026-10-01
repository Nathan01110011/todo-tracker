export interface PhotoDetails {
  url: string;
  comment: string;
  capturedAt: string;
  uploadedAt: string;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  status: string;
  notes: string;
  rating: string;
  priority: string;
  scope: string;
  return?: string | boolean;
  type?: 'place' | 'hotel';
  details?: string;
  date?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  photos?: string;
  photoDetails?: PhotoDetails[];
}
