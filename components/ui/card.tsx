"use client"

import * as React from "react"
import {
  Card as HeroCardPrimitive,
  CardBody as HeroCardBodyPrimitive,
  CardFooter as HeroCardFooterPrimitive,
  CardHeader as HeroCardHeaderPrimitive,
} from "@heroui/react"
import { card as heroCardTheme } from "@heroui/theme"

import { cn } from "@/lib/utils"

const heroCardStyles = heroCardTheme({})

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      heroCardStyles.base(),
      "rounded-lg border border-default-200/60 bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(heroCardStyles.header(), "flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(heroCardStyles.body(), "p-6 pt-0", className)}
    {...props}
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(heroCardStyles.footer(), "flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Hero bridge exports are kept so new callsites can adopt native Hero UI primitives incrementally.
const HeroCard = HeroCardPrimitive
const HeroCardHeader = HeroCardHeaderPrimitive
const HeroCardContent = HeroCardBodyPrimitive
const HeroCardFooter = HeroCardFooterPrimitive

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  HeroCard,
  HeroCardHeader,
  HeroCardContent,
  HeroCardFooter,
}
