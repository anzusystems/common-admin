export const clickBlur = (event?: Event): void => {
  if (event?.currentTarget instanceof HTMLElement) {
    event.currentTarget.blur()
  }
}
