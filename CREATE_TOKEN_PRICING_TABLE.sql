-- Create token_pricing_table for AI model pricing configuration
-- This table stores the cost per 1M tokens for different AI models

CREATE TABLE IF NOT EXISTS public.token_pricing_table (
    "Id" SERIAL PRIMARY KEY,
    "ModelName" VARCHAR(100) NOT NULL,
    "InputCostPer1M" DECIMAL(10, 6) NOT NULL,
    "OutputCostPer1M" DECIMAL(10, 6) NOT NULL,
    "Currency" VARCHAR(10) DEFAULT 'USD',
    "IsActive" BOOLEAN DEFAULT true,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "UpdatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE("ModelName")
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_pricing_model_name 
ON public.token_pricing_table("ModelName") 
WHERE "IsActive" = true;

-- Insert default pricing for common models
-- Gemini models
INSERT INTO public.token_pricing_table 
("ModelName", "InputCostPer1M", "OutputCostPer1M", "Currency") 
VALUES
('gemini-2.5-flash-lite', 0.0075, 0.03, 'USD'),
('gemini-2.0-flash-exp', 0.0, 0.0, 'USD'),
('gemini-1.5-flash', 0.075, 0.30, 'USD'),
('gemini-1.5-pro', 1.25, 5.0, 'USD'),
('gemini-pro', 0.50, 1.50, 'USD')
ON CONFLICT ("ModelName") DO NOTHING;

-- Enable Row Level Security (optional, recommended for production)
ALTER TABLE public.token_pricing_table ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read pricing
CREATE POLICY "Allow authenticated users to read pricing" 
ON public.token_pricing_table 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create policy to allow service role to manage pricing
CREATE POLICY "Allow service role to manage pricing" 
ON public.token_pricing_table 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create function to automatically update UpdatedAt timestamp
CREATE OR REPLACE FUNCTION update_token_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update UpdatedAt
CREATE TRIGGER token_pricing_updated_at_trigger
BEFORE UPDATE ON public.token_pricing_table
FOR EACH ROW
EXECUTE FUNCTION update_token_pricing_updated_at();

-- Grant permissions (adjust based on your needs)
GRANT SELECT ON public.token_pricing_table TO authenticated;
GRANT ALL ON public.token_pricing_table TO service_role;
