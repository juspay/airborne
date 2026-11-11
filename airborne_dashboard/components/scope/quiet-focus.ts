/**
 * How a focused or hovered row looks in the scope picker and the Create chooser: a grey fill, never the brand purple.
 * The purple fill is for the one real primary action on a screen; a row under the cursor is not that, and a purple row
 * before anything was chosen reads as a decision already made.
 */
export const QUIET_ROW = "data-[selected=true]:bg-muted data-[selected=true]:text-foreground";

/** The same, for buttons that are choices in a list (hover and keyboard focus). */
export const QUIET_BUTTON =
  "hover:bg-muted hover:text-foreground focus-visible:bg-muted dark:hover:bg-muted dark:focus-visible:bg-muted";
