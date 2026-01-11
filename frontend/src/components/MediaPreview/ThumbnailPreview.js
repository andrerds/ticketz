import MediaPreview from "./index";

const ThumbnailPreview = ({ mediaUrl, alt, ...props }) => {
  return (
    <MediaPreview mediaUrl={mediaUrl} size="thumbnail" alt={alt} {...props} />
  );
};

export default ThumbnailPreview;
