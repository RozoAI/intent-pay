import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import packageJson from "../../../../package.json";

const Portal = (props: any) => {
  props = {
    selector: "__ROZOPAY__",
    ...props,
  };

  const { selector, children } = props;

  const ref = useRef<Element | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    const selectorPrefixed = "#" + selector.replace(/^#/, "");
    ref.current = document.querySelector(selectorPrefixed);

    if (!ref.current) {
      const div = document.createElement("div");
      div.setAttribute("id", selector);
      div.setAttribute("data-rozopay", `${packageJson.version}`);
      document.body.appendChild(div);
      ref.current = div;
    }

    setMounted(true);
  }, [selector]);

  if (!ref.current) return null;
  return mounted ? createPortal(children, ref.current) : null;
};

export default Portal;
