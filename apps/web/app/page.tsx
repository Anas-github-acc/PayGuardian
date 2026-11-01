import Link from "next/link";
import {
  ArrowRight,
  Bot,
  FileKey,
  ScrollText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-secondary">
              <Shield className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold">PayGuardian</span>
          </Link>

          <nav className="hidden items-center gap-6 text-xs text-muted-foreground md:flex">
            <a href="#platform" className="transition-colors hover:text-foreground">
              Platform
            </a>
            <a href="#agents" className="transition-colors hover:text-foreground">
              Agents
            </a>
            <a href="#docs" className="transition-colors hover:text-foreground">
              Docs
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-secondary"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-xs font-medium text-background shadow-sm transition-opacity hover:bg-foreground/90"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
            style={{
              background:
                "radial-gradient(60% 100% at 50% 0%, oklch(1 0 0 / 0.05), transparent 70%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Zap className="h-3 w-3 text-warning" />
              Sandbox gateway is open — start delegating
              <ArrowRight className="h-3 w-3" />
            </Link>

            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-normal text-foreground sm:text-6xl">
              Bounded authority for agents that spend money.
            </h1>

            <p className="lede mx-auto mt-5 max-w-xl text-center text-sm sm:text-base">
              Your personal agent delegates to travel, hotel and food agents. PayGuardian keeps
              every hop signed, budgeted and revocable — and shows you exactly who may spend what.
            </p>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-xs font-medium text-background shadow-sm transition-opacity hover:bg-foreground/90"
              >
                Open dashboard
              </Link>
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-secondary"
              >
                Sign in
              </Link>
            </div>

            {/* Product preview */}
            <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-md border border-border bg-card text-left shadow-md">
              {/* Mini window topbar */}
              <div className="flex h-9 items-center gap-2 border-b border-border bg-background px-3">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium">PayGuardian</span>
                <span className="ml-auto rounded border border-border bg-secondary px-1 py-px font-mono text-[8px] uppercase text-muted-foreground">
                  Sandbox
                </span>
              </div>

              <div className="flex">
                {/* Mini sidebar */}
                <div className="hidden w-36 shrink-0 border-r border-border p-2 sm:block">
                  {[
                    ["Overview", true],
                    ["Workspace", false],
                    ["Assistant", false],
                    ["Approvals", false],
                    ["Mandates", false],
                    ["Security", false],
                  ].map(([label, active]) => (
                    <div
                      key={label as string}
                      className={`rounded-md px-2 py-1.5 text-[11px] ${
                        active ? "bg-secondary text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Mini content: stats + bars + chat */}
                <div className="min-w-0 flex-1 p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Active agents", "4"],
                      ["Authority", "$10,000"],
                      ["Spent", "$2,450"],
                      ["Approvals", "1"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-border bg-background p-2.5">
                        <div className="text-[10px] text-muted-foreground">{label}</div>
                        <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
                    {/* Mini bar chart */}
                    <div className="rounded-md border border-border bg-background p-3 sm:col-span-3">
                      <div className="text-[10px] text-muted-foreground">Spend velocity</div>
                      <div className="mt-2 flex h-20 items-end gap-1.5">
                        {[38, 22, 55, 62, 80, 30, 20].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t-sm bg-chart-1"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Mini verified chat card */}
                    <div className="rounded-md border border-border bg-background p-3 sm:col-span-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <ShieldCheck className="h-3 w-3 text-success" />
                        Gateway verified
                      </div>
                      <div className="mt-2 rounded-md border border-border bg-secondary p-2 text-[10px] leading-relaxed">
                        Paid IndiGo flight 6E-204 via PayPal.
                        <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                          <span>txn_pp_482913</span>
                          <span className="text-success">completed</span>
                        </div>
                      </div>
                      <div className="mt-2 rounded-md border border-border bg-secondary/60 p-2 text-[10px] text-muted-foreground">
                        Grand Hyatt booking refused: over sub-mandate limit.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="platform" className="border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl">
              Make invisible authority visible
            </h2>
            <p className="lede mx-auto mt-3 text-center text-sm">
              Registration never grants authority. Only signed, bounded mandates do — and every
              hop down the chain narrows it.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: ScrollText,
                  title: "Signed mandates",
                  body: "Budget, scope, expiry and delegation rights, cryptographically bound to the agent identity.",
                },
                {
                  icon: Users,
                  title: "Nested delegation",
                  body: "Personal delegates to Travel, Travel to Hotel. Children can never exceed the parent's authority.",
                },
                {
                  icon: ShieldAlert,
                  title: "Human approvals",
                  body: "Anything above your threshold pauses for explicit sign-off. No silent overrides.",
                },
                {
                  icon: Zap,
                  title: "Instant revocation",
                  body: "Cut off one agent and its whole subtree in a click. In-flight actions resolve by real state.",
                },
                {
                  icon: FileKey,
                  title: "Tamper-evident audit",
                  body: "Trace any payment from child agent to the root mandate that allowed it.",
                },
                {
                  icon: Terminal,
                  title: "MCP & REST",
                  body: "Connect your own agents and frameworks. The gateway enforces the same rules everywhere.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="bg-card p-6">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Agent suite */}
        <section id="agents" className="border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-2xl font-semibold sm:text-3xl">
                  A suite of agents, one chokepoint
                </h2>
                <p className="lede mt-3 text-sm">
                  Personal, Travel, Hotel, Transport, Food and Activities ship as ADK agents. Your
                  own agents plug in through MCP — and are subject to the same budget and
                  authorization rules.
                </p>
                <Link
                  href="/dashboard"
                  className="mt-6 inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-secondary"
                >
                  Explore the workspace
                  <ArrowRight className="ml-1.5 h-3 w-3" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { icon: Bot, label: "Personal" },
                  { icon: Wallet, label: "Travel" },
                  { icon: Bot, label: "Hotel" },
                  { icon: Bot, label: "Transport" },
                  { icon: Wallet, label: "Food" },
                  { icon: Bot, label: "Activities" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-2 rounded-md border border-border bg-card py-5 text-center"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-semibold sm:text-3xl">Hand over the keys. Keep the control.</h2>
            <p className="lede mx-auto mt-3 text-sm">
              Create an environment, set the budget, connect an agent — in minutes.
            </p>
            <Link
              href="/dashboard"
              className="mt-7 inline-flex h-9 items-center rounded-md bg-foreground px-5 text-xs font-medium text-background shadow-sm transition-opacity hover:bg-foreground/90"
            >
              Open dashboard
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>© 2026 PayGuardian LLC</span>
          </div>
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="#docs" className="transition-colors hover:text-foreground">
              Documentation
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
