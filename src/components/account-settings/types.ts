export type AccountSettingsTabKey =
  | "profile"
  | "public-profile"
  | "communications"
  | "usage"
  | "memory"
  | "security"
  | "danger"

export type AccountSettingsMobilePage = "menu" | AccountSettingsTabKey

export type AccountSettingsErrorKey =
  | "firstName"
  | "lastName"
  | "phone"
  | "orgName"
  | "orgDesc"
  | "applyingAs"
  | "stage"
  | "problem"
