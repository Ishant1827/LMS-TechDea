import { Library } from "lucide-react";
import ComingSoon from "../components/ComingSoon";

export default function AdminCatalog() {
  return (
    <ComingSoon
      title="Catalog"
      icon={Library}
      blurb="Shape what students see in Browse Courses."
      points={[
        "Manage categories and tags",
        "Feature / pin courses",
        "Approve courses before they go public",
        "Reassign a course to a different teacher",
      ]}
    />
  );
}
