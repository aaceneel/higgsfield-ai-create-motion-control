-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create enum for generation status
create type generation_status as enum ('pending', 'processing', 'completed', 'failed');

-- Generations table - stores all video generation history
create table public.generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  
  -- Input files
  reference_image_url text not null,
  motion_video_url text not null,
  
  -- Output
  result_video_url text,
  
  -- Status tracking
  status generation_status not null default 'pending',
  kling_task_id text not null,
  progress integer default 0,
  error_message text,
  
  -- Generation settings (stored as JSONB for flexibility)
  settings jsonb not null default '{}'::jsonb,
  
  -- Metadata
  credits_used numeric(10, 2),
  duration integer, -- video duration in seconds
  
  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User settings table - stores user preferences
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  
  -- Default generation settings
  default_settings jsonb default '{
    "motionStrength": 65,
    "matchMode": "structure",
    "quality": "720p",
    "aspectRatio": "9:16",
    "negativePrompt": ""
  }'::jsonb,
  
  -- UI preferences
  theme text default 'dark',
  
  -- Optional: Store user's own Kling API keys (encrypted in production)
  kling_access_key text,
  kling_secret_key text,
  
  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index generations_user_id_idx on public.generations(user_id);
create index generations_status_idx on public.generations(status);
create index generations_created_at_idx on public.generations(created_at desc);
create index generations_kling_task_id_idx on public.generations(kling_task_id);

-- Enable Row Level Security
alter table public.generations enable row level security;
alter table public.user_settings enable row level security;

-- RLS Policies for generations table
-- Users can only see their own generations
create policy "Users can view their own generations"
  on public.generations
  for select
  using (auth.uid() = user_id);

-- Users can insert their own generations
create policy "Users can create their own generations"
  on public.generations
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own generations
create policy "Users can update their own generations"
  on public.generations
  for update
  using (auth.uid() = user_id);

-- Users can delete their own generations
create policy "Users can delete their own generations"
  on public.generations
  for delete
  using (auth.uid() = user_id);

-- RLS Policies for user_settings table
-- Users can only see their own settings
create policy "Users can view their own settings"
  on public.user_settings
  for select
  using (auth.uid() = user_id);

-- Users can insert their own settings
create policy "Users can create their own settings"
  on public.user_settings
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own settings
create policy "Users can update their own settings"
  on public.user_settings
  for update
  using (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers to update updated_at
create trigger handle_generations_updated_at
  before update on public.generations
  for each row
  execute function public.handle_updated_at();

create trigger handle_user_settings_updated_at
  before update on public.user_settings
  for each row
  execute function public.handle_updated_at();

-- Function to create user_settings on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_settings (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create user_settings when a new user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
