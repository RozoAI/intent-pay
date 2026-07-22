import styled from "../../styles/styled";

/** Card wrapper — two-panel grid layout */
export const CardContainer = styled.div<{
  $width?: number | string;
  $height?: number | string;
}>`
  width: ${(props) => props.$width ?? 480}px;
  height: ${(props) => props.$height ?? "auto"};
  background: var(--ck-body-background);
  border: 1px solid var(--ck-modal-box-border-color, rgba(0, 0, 0, 0.06));
  border-radius: var(--ck-border-radius, 20px);
  box-shadow: var(--ck-modal-box-shadow, 0px 2px 8px rgba(0, 0, 0, 0.04));
  overflow: hidden;
  font-family: var(--ck-font-family);
  box-sizing: border-box;

  @media (max-width: 640px) {
    width: 100%;
    max-width: ${(props) => props.$width ?? 480}px;
  }
`;

/** Card header — payment amount and recipient */
export const CardHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--ck-modal-divider, rgba(0, 0, 0, 0.06));
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--ck-body-color);
`;

/** Card body — two-panel grid */
export const CardBody = styled.div`
  display: grid;
  grid-template-columns: 200px 1fr;
  min-height: 320px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
`;

/** Left panel — wallet list, context */
export const LeftPanel = styled.div`
  border-right: 1px solid var(--ck-modal-divider, rgba(0, 0, 0, 0.06));
  padding: 16px;
  overflow-y: auto;
  max-height: 400px;

  @media (max-width: 640px) {
    border-right: none;
    border-bottom: 1px solid var(--ck-modal-divider, rgba(0, 0, 0, 0.06));
    max-height: 200px;
  }
`;

/** Right panel — action area */
export const RightPanel = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

/** Card footer — Powered by + Help */
export const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--ck-modal-divider, rgba(0, 0, 0, 0.06));
  font-size: 12px;
  color: var(--ck-body-color-muted);
`;

/** Section label in left panel */
export const SectionLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ck-body-color-muted);
  margin-bottom: 8px;
`;

/** Wallet item in left panel */
export const WalletItem = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 12px;
  background: ${(props) =>
    props.$active
      ? "var(--ck-accent-color, #1A88F8)"
      : "transparent"};
  color: ${(props) =>
    props.$active
      ? "var(--ck-accent-text-color, #ffffff)"
      : "var(--ck-body-color)"};
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  transition: background 150ms ease;

  &:hover {
    background: ${(props) =>
      props.$active
        ? "var(--ck-accent-color, #1A88F8)"
        : "var(--ck-secondary-button-hover-background, rgba(0, 0, 0, 0.04))"};
  }

  img, svg {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  > div:first-child {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
`;

/** Network choice button */
export const NetworkButton = styled.button`
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--ck-modal-box-border-color, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  background: var(--ck-body-background);
  color: var(--ck-body-color);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 150ms ease;

  &:hover {
    border-color: var(--ck-accent-color, #1A88F8);
    background: var(--ck-secondary-button-hover-background, rgba(26, 136, 248, 0.04));
  }
`;

/** Help button */
export const HelpButton = styled.button`
  border: none;
  background: none;
  color: var(--ck-body-color-muted);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 150ms ease;

  &:hover {
    background: var(--ck-secondary-button-hover-background, rgba(0, 0, 0, 0.04));
  }
`;
