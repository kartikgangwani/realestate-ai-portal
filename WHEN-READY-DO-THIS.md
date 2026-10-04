# Jab online ho, sirf ye 5 kaam karne hain

Code check ho chuka hai (no errors). Password + secret pehle se generate ho chuke hain
(.env.production.txt file me hai, isi folder ke andar).

## 1. GitHub par private repo banao
- github.com par account banao
- "New repository" -> naam do -> "Private" select karo -> Create

## 2. Is poore folder ko GitHub repo me upload karo
- Repo page par "uploading an existing file" link milega
- Is `RealEstate-AI-Railway-Ready` folder ke andar ki saari files drag-drop kar do
  (.env.production.txt file UPLOAD MAT KARNA — sirf apne paas rakhna, GitHub pe nahi)
- Commit kar do

## 3. Railway par account banao aur deploy karo
- railway.app -> "Login with GitHub"
- "New Project" -> "Deploy from GitHub repo" -> apna repo select karo

## 4. Database aur Variables add karo
- Railway project ke andar "+ New" -> "Database" -> "PostgreSQL" add karo
- Apni app service par jao -> "Variables" tab
- .env.production.txt file kholo, wahan se saari values copy-paste karo
  (DATABASE_URL apne aap link ho jayega Railway se)

## 5. Deploy hote hi URL milega
- Railway "Deployments" tab me ek URL dega (xxx.up.railway.app)
- Wahan jao, username: portaladmin, password: .env.production.txt me dekho
- Login karke test karo — sirf dummy/test data dalna, real customer nahi

Kahin bhi atko toh error ka screenshot/message Claude ko bhej dena.
