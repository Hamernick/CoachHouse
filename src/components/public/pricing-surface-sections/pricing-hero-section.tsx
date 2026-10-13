export function PricingHeroSection({
  headingLevel = "h1",
}: {
  headingLevel?: "h1" | "h2"
}) {
  const Heading = headingLevel

  return (
    <section className="mx-auto max-w-3xl text-center">
      <p className="text-muted-foreground mb-3 text-sm">Pricing</p>
      <Heading
        id="pricing-heading"
        className="text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl"
      >
        Simple pricing
        <br />
        for nonprofit builders
      </Heading>
      <p className="text-muted-foreground mx-auto mt-2 max-w-2xl text-base leading-snug text-balance sm:text-lg lg:text-xl">
        Start free, upgrade to build your organization in one place.
      </p>
    </section>
  )
}
