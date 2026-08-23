// src/lib/closeDatePicker.ts
// PURPOSE: Shared on:change handler for <input type="date"/"datetime-local"> that closes the
//   native picker as soon as a value is chosen, instead of leaving it open until the user clicks
//   elsewhere.
// IT: a synchronous blur() call from inside the "change" handler is a no-op in Chromium - the
//   picker's own close logic runs later in the same tick and overrides it. Deferring via
//   setTimeout(0) lets that logic finish first, so the blur actually takes effect.

export function closeDatePickerOnChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  setTimeout(() => input.blur(), 0);
}
