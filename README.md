# 3D Asset Uploader — Admin Panel

Drop a `.glb` file → auto-uploads to S3 → auto-saves to Supabase → live on your site.

## How it works

```
You fill the form + drop .glb
         ↓
/api/upload  (Vercel serverless — AWS keys are safe here)
         ↓
Uploads GLB + images to Amazon S3 → gets public URLs
         ↓
Inserts row into Supabase with all URLs + metadata
         ↓
Your main React site fetches from Supabase → renders model live
```

---

## Setup (one time)

### 1. Supabase Table
Open Supabase Dashboard → SQL Editor → paste and run `supabase-setup.sql`

### 2. S3 Bucket
Make sure your S3 bucket has public read access or use a CloudFront CDN.
Add this bucket CORS policy:
```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "PUT", "POST"],
  "AllowedOrigins": ["*"],
  "ExposeHeaders": []
}]
```

### 3. Environment Variables
Copy `.env.example` to `.env.local` and fill in all values.

In Vercel Dashboard → your project → Settings → Environment Variables,
add all the same variables (without VITE_ prefix for server-side ones).

### 4. Install & Run locally
```bash
npm install
npm run dev        # starts Vercel dev server (handles both Vite + /api routes)
```

### 5. Deploy
```bash
git add . && git commit -m "admin panel"
git push           # Vercel auto-deploys
```

---

## In your main React site

```ts
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY   // anon key is safe for reads
)

// hooks/useModels.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useModels(category?: string) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let query = supabase.from('models').select('*').order('created_at', { ascending: false })
    if (category) query = query.eq('category', category)
    query.then(({ data }) => { setModels(data ?? []); setLoading(false) })
  }, [category])

  return { models, loading }
}
```

Then in your component:
```tsx
const { models, loading } = useModels()
// models[0].glb  ← the S3 URL, ready to use with @react-three/fiber
```

---

## Security note
- `SUPABASE_SERVICE_ROLE_KEY` only lives in the serverless function — never in frontend code
- `ADMIN_SECRET` header protects the upload endpoint from public access
- AWS credentials never touch the browser
