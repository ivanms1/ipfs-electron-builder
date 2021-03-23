import fs from "fs";
import path from "path";
import { ipcMain } from "electron";
import IPFS from "ipfs-core";
import Protector from "libp2p/src/pnet";
import all from "it-all";
import uint8ArrayConcat from "uint8arrays/concat";
import Jimp from "jimp";
import fetch from "electron-fetch";

let node: any;

const BOOTSTRAP_ADDRESSS =
  "/ip4/15.164.229.6/tcp/4001/ipfs/12D3KooWNubmXubMPzPY9B69HLAEpoRBS41MchdGCa9SgJtd5LnT";

ipcMain.handle("upload-file", async (_, info) => {
  try {
    const descriptionHash = await node.add({ content: info.description });
    const preview = await Jimp.read(info.preview.path);
    await preview.resize(720, 404).quality(95);
    const previewContent = await preview.getBufferAsync(preview.getMIME());
    const previewHash = await node.add({
      content: previewContent,
    });

    const file = fs.readFileSync(info.file.path);
    const fileContent = Buffer.from(file);
    const fileHash = await node.add({
      content: fileContent,
    });

    const body = {
      title: info.file.title,
      info: {
        ccid: String(fileHash.cid),
        desc: String(descriptionHash.cid),
        txhash: "x0020202",
        file_name: info.file.name,
        ext: info.file.ext,
        size: info.file.size,
        thumbnail: String(previewHash.cid),
      },
      cate_id: 1,
      user: {
        wallet_id: "x0020202",
      },
    };

    // @ts-expect-error
    const res = await fetch.default(
      "http://192.168.100.54:8000/api/content/register",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await res.json();

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

ipcMain.handle("download-file", async (_, hash) => {
  try {
    // eslint-disable-next-line
    for await (const file of node.get(hash)) {
      // eslint-disable-next-line
      if (!file.content) continue;

      const content = [];

      // eslint-disable-next-line
      for await (const chunk of file.content) {
        content.push(chunk);
      }

      return {
        success: true,
        file: content,
      };
    }

    return {
      success: false,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

ipcMain.handle("get-image-preview", async (_, file) => {
  try {
    const description = uint8ArrayConcat(await all(node.cat(file.info.desc)));

    const preview = uint8ArrayConcat(await all(node.cat(file.info.thumbnail)));

    return {
      success: true,
      description,
      preview,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

ipcMain.handle("connect-to-ipfs", async () => {
  try {
    node = await IPFS.create({
      libp2p: {
        modules: {
          connProtector: new Protector(
            fs.readFileSync(path.join(__dirname + "/../../assets/swarm.key"))
          ),
        },
      },
      // @ts-expect-error
      config: {
        Bootstrap: [BOOTSTRAP_ADDRESSS],
      },
    });

    const version = await node.version();
    const id = await node.id();

    return {
      success: true,
      version,
      id,
    };
  } catch (error) {
    return {
      success: false,
      error,
    };
  }
});
