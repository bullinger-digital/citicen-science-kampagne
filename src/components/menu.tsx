"use client";
import { IoMdMenu } from "react-icons/io";
import client from "../../tina/__generated__/client";
import { useEffect, useRef, useState } from "react";
import { Link } from "./common/navigation-block/link";
import { useOutsideClick } from "./common/useOutsideClick";

const fetchMenuItems = async () => {
  return client.queries.menu({
    relativePath: `main.md`,
  });
};

export const Menu = () => {
  const [menu, setMenu] =
    useState<Awaited<ReturnType<typeof fetchMenuItems> | null>>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setMenuVisible(false));

  useEffect(() => {
    fetchMenuItems()
      .then((data) => {
        setMenu(data);
      })
      .catch((error) => {
        console.error("Error fetching menu items", error);
      });
  }, []);

  return (
    <div ref={ref} className="flex items-center relative">
      <button onClick={() => setMenuVisible(!menuVisible)}>
        <IoMdMenu className="text-3xl" />
      </button>
      {menuVisible && (
        <div
          className="absolute top-full bg-white shadow-2xl p-3 z-[40] mt-2"
          onClick={() => setMenuVisible(false)}
        >
          <ul>
            {menu?.data?.menu.menu?.map((item) => {
              return (
                <li key={item?.page?.id}>
                  <Link
                    href={`/pages/${item?.page?.slug}`}
                    className="py-1 pr-10 block hover:text-emerald-400"
                  >
                    {item?.page?.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
