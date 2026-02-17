-- Drop existing table if it exists
DROP TABLE IF EXISTS public.token_pricing_table CASCADE;

-- Create token_pricing_config_table for AI model pricing configuration
-- This table stores the cost per 1M tokens for different AI models per user

CREATE TABLE IF NOT EXISTS public.token_pricing_config_table (
    "Id" SERIAL PRIMARY KEY,
    "UserId" INTEGER NOT NULL,
    "ModelName" VARCHAR(100) NOT NULL,
    "InputPerMillion" DECIMAL(10, 6) NOT NULL,
    "OutputPerMillion" DECIMAL(10, 6) NOT NULL,
    "Currency" VARCHAR(10) DEFAULT 'USD',
    "IsActive" BOOLEAN DEFAULT true,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE("UserId", "ModelName")
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_pricing_user_model 
ON public.token_pricing_config_table("UserId", "ModelName") 
WHERE "IsActive" = true;

-- Enable Row Level Security (recommended for production)
ALTER TABLE public.token_pricing_config_table ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage pricing (for backend API)
CREATE POLICY "Allow service role full access" 
ON public.token_pricing_config_table 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create function to automatically update UpdatedAt timestamp
CREATE OR REPLACE FUNCTION update_token_pricing_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update UpdatedAt
CREATE TRIGGER token_pricing_config_updated_at_trigger
BEFORE UPDATE ON public.token_pricing_config_table
FOR EACH ROW
EXECUTE FUNCTION update_token_pricing_config_updated_at();

-- Grant permissions (adjust based on your needs)
GRANT ALL ON public.token_pricing_config_table TO service_role;
