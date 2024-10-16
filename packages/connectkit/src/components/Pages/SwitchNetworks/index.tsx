import React from "react";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import ChainSelectList from "../../Common/ChainSelectList";
import {
  ModalBody,
  ModalContent,
  PageContent,
} from "../../Common/Modal/styles";

import useLocales from "../../../hooks/useLocales";

import { DisconnectIcon } from "../../../assets/icons";
import { useChainIsSupported } from "../../../hooks/useChainIsSupported";
import { isSafeConnector } from "../../../utils";
import Button from "../../Common/Button";
import { OrDivider } from "../../Common/Modal";

const SwitchNetworks: React.FC = () => {
  const { reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { connector, chain } = useAccount();
  const isChainSupported = useChainIsSupported(chain?.id);

  const locales = useLocales({});

  const onDisconnect = () => {
    disconnect();
    reset();
  };

  return (
    <PageContent style={{ width: 278 }}>
      <ModalContent style={{ padding: 0, marginTop: -10 }}>
        {!isChainSupported && (
          <ModalBody>
            {locales.warnings_chainUnsupported}{" "}
            {locales.warnings_chainUnsupportedResolve}
          </ModalBody>
        )}

        <div style={{ padding: "6px 8px" }}>
          <ChainSelectList variant="secondary" />
        </div>

        {!isChainSupported && !isSafeConnector(connector?.id) && (
          <div style={{ paddingTop: 12 }}>
            <OrDivider />
            <Button
              icon={<DisconnectIcon />}
              variant="secondary"
              onClick={onDisconnect}
            >
              {locales.disconnect}
            </Button>
          </div>
        )}
      </ModalContent>
    </PageContent>
  );
};

export default SwitchNetworks;
