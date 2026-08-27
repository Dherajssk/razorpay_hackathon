const { z } = require("zod");
const productService = require("../../services/productService");

const searchProductsTool = {
  name: "search_products",

  description:
    "Search the merchant's product catalog using category, brand, price, specifications, GPU, refresh rate, and stock availability.",

  inputSchema: {
    category: z.string().optional(),
    brand: z.string().optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    ram: z.number().optional(),
    storage: z.number().optional(),
    gpu: z.string().optional(),
    refreshRate: z.number().optional(),
    inStock: z.boolean().optional()
  },

  async execute(args) {
    try {
      console.error(
        "[MCP] search_products:",
        JSON.stringify(args)
      );

      const filters = {
        ...args,
        inStock:
          args.inStock !== undefined
            ? String(args.inStock)
            : undefined
      };

      const products =
        await productService.searchProducts(filters);

      const formattedProducts = products.map((product) => ({
        id: product._id.toString(),
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        currency: product.currency,
        stock: product.stock,
        specifications: product.specifications,
        rating: product.rating,
        deliveryDays: product.deliveryDays,
        description: product.description
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: formattedProducts.length,
                products: formattedProducts
              },
              null,
              2
            )
          }
        ]
      };

    } catch (error) {
      console.error(
        "[MCP] search_products error:",
        error.message
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Failed to search products",
              message: error.message
            })
          }
        ],
        isError: true
      };
    }
  }
};

module.exports = searchProductsTool;