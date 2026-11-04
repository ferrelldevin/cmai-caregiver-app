// Every story gets the app's fonts and design tokens (src/styles.css), plus two toolbar
// switches: Theme sets data-theme the way the app does, Text tries the large text size.
import type { Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-600.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "../src/styles.css";
import "../src/mockup/mockup.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Light or dark theme",
      toolbar: { title: "Theme", icon: "mirror", items: ["light", "dark"], dynamicTitle: true },
    },
    textSize: {
      description: "Text size, as in Settings",
      toolbar: { title: "Text", icon: "paragraph", items: ["standard", "large"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light", textSize: "standard" },
  decorators: [
    (Story, ctx) => {
      const theme = ctx.globals.theme as string;
      const textSize = ctx.globals.textSize as string;
      useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.dataset.mkText = textSize;
      }, [theme, textSize]);
      return <Story />;
    },
  ],
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
};

export default preview;
