
declare module "mongoose" {
	namespace Schema {
		namespace Types {
			export interface ObjectId {
				_id: this;
				equals(id: ObjectId): boolean;
			}
		}
	}
}