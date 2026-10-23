"use client"

import { Children, isValidElement, useEffect, useState, type ReactNode } from "react"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"

export function ProgramsCarousel({
  children,
  heading,
  introduction,
}: {
  children: ReactNode
  heading: ReactNode
  introduction?: ReactNode
}) {
  const cards = Children.toArray(children)
  const [api, setApi] = useState<CarouselApi>()
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!api) return
    const updateSelection = () => setSelected(api.selectedScrollSnap())
    updateSelection()
    api.on("select", updateSelection)
    api.on("reInit", updateSelection)
    return () => {
      api.off("select", updateSelection)
      api.off("reInit", updateSelection)
    }
  }, [api])

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: "center", loop: false }}
      aria-label="Resource"
      className="grid w-full min-w-0 gap-4"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        {heading}
        {cards.length > 1 ? (
          <div className="flex shrink-0 items-center justify-end gap-2">
            <CarouselPrevious
              aria-label="Previous resource"
              className="relative top-auto left-auto right-auto size-8 translate-y-0 shadow-none after:absolute after:-inset-1.5 md:after:hidden"
            />
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="text-muted-foreground min-w-10 text-center text-xs tabular-nums"
            >
              {selected + 1} of {cards.length}
            </span>
            <CarouselNext
              aria-label="Next resource"
              className="relative top-auto left-auto right-auto size-8 translate-y-0 shadow-none after:absolute after:-inset-1.5 md:after:hidden"
            />
          </div>
        ) : null}
      </div>
      {introduction}
      <div className="mx-auto w-full min-w-0 max-w-[388px] [&>div]:overflow-clip">
        <CarouselContent className="ml-0 touch-pan-y">
          {cards.map((card, index) => (
            <CarouselItem
              key={isValidElement(card) ? card.key : index}
              aria-label={`${index + 1} of ${cards.length}`}
              aria-hidden={index !== selected}
              inert={index !== selected}
              className="p-1"
            >
              {card}
            </CarouselItem>
          ))}
        </CarouselContent>
      </div>
    </Carousel>
  )
}
