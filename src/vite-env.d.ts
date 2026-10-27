/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** where the dataset is fetched from; unset in the public build */
  readonly VITE_DATA_URL?: string
}
