// STUB: replaced by the frontend work package. Keeps the build green until then.
import ImageCompressor from './ImageCompressor';
export default function ImageTool(props: { defaultMaxKb?: number }) {
  return <ImageCompressor defaultTargetKb={props.defaultMaxKb ?? 50} />;
}
