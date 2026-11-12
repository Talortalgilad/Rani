/** The room behind each world's tasks: a picture (public/english/bg/<world>.webp, 1080 wide), loaded when the world is entered. */
export const bgUrl = (world: number): string => `${import.meta.env.BASE_URL}english/bg/${world}.webp`;
export const sceneImg = (world: number): string => `<img class="scene-img" src="${bgUrl(world)}" alt="" draggable="false" decoding="async">`;
