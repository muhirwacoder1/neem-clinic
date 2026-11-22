# NEEM Wellness

Clinic website and staff portal for appointments, check-in, billing, inventory, and appointment updates. The interface follows the [NEEM Wellness Studio Style Guide](https://stodio-ten.vercel.app/utility-pages/style-guide).

The app runs on TanStack Start. Convex stores clinic data and validates business operations, and Clerk handles staff identity. See [architecture and cutover instructions](ARCHITECTURE.md) for environment configuration, existing staff access, and the data import.

## Local development

Use Bun to install the locked dependencies and Node.js 22.18+ for the import and test scripts.

```sh
bun install
bunx convex dev
bun run dev
```

Use [.env.example](.env.example) as the template for your ignored `.env.local` file. With Node.js, run `node --env-file=.env.local ./node_modules/vite/bin/vite.js dev` to load server-side settings into the local process. Convex environment values are set on the Convex deployment separately from the TanStack server. For a fresh installation, create the active, non-bookable Reception department in the staff dashboard before using reception billing.

Run the local migration checks with `bun run test:migration`. These checks use synthetic data and do not require a cloud account.

The legacy production app is at [MotionWell on Lovable](https://motionwell.lovable.app). The [Lovable project](https://lovable.dev/projects/f685a318-a270-43ac-90af-386095184ee9) remains connected to the original repository.
