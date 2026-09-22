import type { StaticImageData } from "next/image"

import quickstart from "../assets/heroes/quickstart.webp"
import keyConcepts from "../assets/heroes/key-concepts.webp"
import bestPracticesMission from "../assets/heroes/best-practices-mission.webp"
import bestPracticesCompliance from "../assets/heroes/best-practices-compliance.webp"
import bestPracticesFundraising from "../assets/heroes/best-practices-fundraising.webp"
import bestPracticesMarketing from "../assets/heroes/best-practices-marketing.webp"
import bestPracticesFrameworks from "../assets/heroes/best-practices-frameworks.webp"
import bestPracticesMeasuringImpact from "../assets/heroes/best-practices-measuring-impact.webp"
import bestPracticesSustainability from "../assets/heroes/best-practices-sustainability.webp"
import bestPracticesPartnerships from "../assets/heroes/best-practices-partnerships.webp"
import toolsBrandIdentity from "../assets/heroes/tools-brand-identity.webp"
import toolsSocialMedia from "../assets/heroes/tools-social-media.webp"
import toolsNetworking from "../assets/heroes/tools-networking.webp"
import toolsHr from "../assets/heroes/tools-hr.webp"
import toolsFinance from "../assets/heroes/tools-finance.webp"
import toolsLegal from "../assets/heroes/tools-legal.webp"
import toolsCampaigns from "../assets/heroes/tools-campaigns.webp"
import toolsCrm from "../assets/heroes/tools-crm.webp"
import marketplaceCoachHouseCoaching from "../assets/heroes/marketplace-coach-house-coaching.webp"
import marketplaceTechsoup from "../assets/heroes/marketplace-techsoup.webp"
import marketplaceGoogleForNonprofits from "../assets/heroes/marketplace-google-for-nonprofits.webp"
import marketplaceMicrosoftForNonprofits from "../assets/heroes/marketplace-microsoft-for-nonprofits.webp"
import marketplaceCanvaForNonprofits from "../assets/heroes/marketplace-canva-for-nonprofits.webp"
import marketplaceGrantsGov from "../assets/heroes/marketplace-grants-gov.webp"
import marketplaceIrsExemptOrganizationLearning from "../assets/heroes/marketplace-irs-exempt-organization-learning.webp"
import marketplaceCandidLearning from "../assets/heroes/marketplace-candid-learning.webp"
import marketplaceCandidSearch from "../assets/heroes/marketplace-candid-search.webp"
import marketplaceIdealistVolunteermatch from "../assets/heroes/marketplace-idealist-volunteermatch.webp"
import marketplaceBoardsource from "../assets/heroes/marketplace-boardsource.webp"
import marketplaceCatchafire from "../assets/heroes/marketplace-catchafire.webp"
import marketplaceLittleGreenLight from "../assets/heroes/marketplace-little-green-light.webp"
import marketplaceGivebutter from "../assets/heroes/marketplace-givebutter.webp"
import marketplaceGoogleAdGrants from "../assets/heroes/marketplace-google-ad-grants.webp"
import marketplaceGoogleWorkspaceNonprofits from "../assets/heroes/marketplace-google-workspace-nonprofits.webp"
import marketplaceDesignGigsForGood from "../assets/heroes/marketplace-design-gigs-for-good.webp"
import marketplaceTaprootPlus from "../assets/heroes/marketplace-taproot-plus.webp"
import marketplaceCatchafireResourceBank from "../assets/heroes/marketplace-catchafire-resource-bank.webp"
import marketplaceTechsoupDigitalAssessment from "../assets/heroes/marketplace-techsoup-digital-assessment.webp"
import marketplaceAdobeExpressNonprofits from "../assets/heroes/marketplace-adobe-express-nonprofits.webp"
import marketplaceAsanaNonprofits from "../assets/heroes/marketplace-asana-nonprofits.webp"
import marketplaceTrustlaw from "../assets/heroes/marketplace-trustlaw.webp"
import marketplaceMonkeypod from "../assets/heroes/marketplace-monkeypod.webp"
import marketplaceStripe from "../assets/heroes/marketplace-stripe-nonprofits.webp"
import marketplaceSubstack from "../assets/heroes/marketplace-substack.webp"
import marketplaceSquarespace from "../assets/heroes/marketplace-squarespace.webp"
import marketplaceInstagram from "../assets/heroes/marketplace-instagram.webp"
import marketplaceFacebook from "../assets/heroes/marketplace-facebook.webp"
import marketplaceTiktok from "../assets/heroes/marketplace-tiktok.webp"
import marketplaceLinkedin from "../assets/heroes/marketplace-linkedin.webp"
import marketplaceX from "../assets/heroes/marketplace-x.webp"
import marketplaceZeffy from "../assets/heroes/marketplace-zeffy.webp"
import marketplaceVenmo from "../assets/heroes/marketplace-venmo-charity-profiles.webp"

// One authored image per article; no shared palette fallback.
export const documentationArtwork = {
  "quickstart": quickstart,
  "key-concepts": keyConcepts,
  "best-practices/mission": bestPracticesMission,
  "best-practices/compliance": bestPracticesCompliance,
  "best-practices/fundraising": bestPracticesFundraising,
  "best-practices/marketing": bestPracticesMarketing,
  "best-practices/frameworks": bestPracticesFrameworks,
  "best-practices/measuring-impact": bestPracticesMeasuringImpact,
  "best-practices/sustainability": bestPracticesSustainability,
  "best-practices/partnerships": bestPracticesPartnerships,
  "tools/brand-identity": toolsBrandIdentity,
  "tools/social-media": toolsSocialMedia,
  "tools/networking": toolsNetworking,
  "tools/hr": toolsHr,
  "tools/finance": toolsFinance,
  "tools/legal": toolsLegal,
  "tools/campaigns": toolsCampaigns,
  "tools/crm": toolsCrm,
  "marketplace/coach-house-coaching": marketplaceCoachHouseCoaching,
  "marketplace/techsoup": marketplaceTechsoup,
  "marketplace/google-for-nonprofits": marketplaceGoogleForNonprofits,
  "marketplace/microsoft-for-nonprofits": marketplaceMicrosoftForNonprofits,
  "marketplace/canva-for-nonprofits": marketplaceCanvaForNonprofits,
  "marketplace/grants-gov": marketplaceGrantsGov,
  "marketplace/irs-exempt-organization-learning": marketplaceIrsExemptOrganizationLearning,
  "marketplace/candid-learning": marketplaceCandidLearning,
  "marketplace/candid-search": marketplaceCandidSearch,
  "marketplace/idealist-volunteermatch": marketplaceIdealistVolunteermatch,
  "marketplace/boardsource": marketplaceBoardsource,
  "marketplace/catchafire": marketplaceCatchafire,
  "marketplace/little-green-light": marketplaceLittleGreenLight,
  "marketplace/givebutter": marketplaceGivebutter,
  "marketplace/google-ad-grants": marketplaceGoogleAdGrants,
  "marketplace/google-workspace-nonprofits": marketplaceGoogleWorkspaceNonprofits,
  "marketplace/design-gigs-for-good": marketplaceDesignGigsForGood,
  "marketplace/taproot-plus": marketplaceTaprootPlus,
  "marketplace/catchafire-resource-bank": marketplaceCatchafireResourceBank,
  "marketplace/techsoup-digital-assessment": marketplaceTechsoupDigitalAssessment,
  "marketplace/adobe-express-nonprofits": marketplaceAdobeExpressNonprofits,
  "marketplace/asana-nonprofits": marketplaceAsanaNonprofits,
  "marketplace/trustlaw": marketplaceTrustlaw,
  "marketplace/monkeypod": marketplaceMonkeypod,
  "marketplace/stripe-nonprofits": marketplaceStripe,
  "marketplace/substack": marketplaceSubstack,
  "marketplace/squarespace": marketplaceSquarespace,
  "marketplace/instagram": marketplaceInstagram,
  "marketplace/facebook": marketplaceFacebook,
  "marketplace/tiktok": marketplaceTiktok,
  "marketplace/linkedin": marketplaceLinkedin,
  "marketplace/x": marketplaceX,
  "marketplace/zeffy": marketplaceZeffy,
  "marketplace/venmo-charity-profiles": marketplaceVenmo,
} as const satisfies Record<string, StaticImageData>

export function getDocumentationArtwork(page: string): StaticImageData {
  const artwork = documentationArtwork[page as keyof typeof documentationArtwork]
  if (!artwork) throw new Error(`Missing Documentation artwork for "${page}"`)
  return artwork
}
